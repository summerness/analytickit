import { Properties } from '@analytickit/plugin-scaffold'
import { StatsD } from 'hot-shots'
import LRU from 'lru-cache'
import { DateTime } from 'luxon'

import { ONE_HOUR, ONE_MINUTE } from '../../config/constants'
import { PluginsServerConfig, PropertyType, Team, TeamId } from '../../types'
import { DB } from '../../utils/db/db'
import { timeoutGuard } from '../../utils/db/utils'
import { analytickit } from '../../utils/analytickit'
import { status } from '../../utils/status'
import { getByAge, UUIDT } from '../../utils/utils'
import { detectPropertyDefinitionTypes } from './property-definitions-auto-discovery'
import { PropertyDefinitionsCache } from './property-definitions-cache'

// for e.g. internal events we don't want to be available for users in the UI
const EVENTS_WITHOUT_EVENT_DEFINITION = ['$$plugin_metrics']
// These are used internally for manipulating person/group properties
const NOT_SYNCED_PROPERTIES = new Set([
    '$set',
    '$set_once',
    '$unset',
    '$group_0',
    '$group_1',
    '$group_2',
    '$group_3',
    '$group_4',
])

type TeamCache<T> = Map<TeamId, [T, number]>

export class TeamManager {
    db: DB
    teamCache: TeamCache<Team | null>
    eventDefinitionsCache: Map<TeamId, Set<string>>
    eventPropertiesCache: LRU<string, Set<string>> // Map<JSON.stringify([TeamId, Event], Set<Property>>
    eventLastSeenCache: LRU<string, number> // key: JSON.stringify([team_id, event]); value: parseInt(YYYYMMDD)
    propertyDefinitionsCache: PropertyDefinitionsCache
    instanceSiteUrl: string
    statsd?: StatsD
    private readonly lruCacheSize: number

    constructor(db: DB, serverConfig: PluginsServerConfig, statsd?: StatsD) {
        this.db = db
        this.statsd = statsd
        this.teamCache = new Map()
        this.eventDefinitionsCache = new Map()
        this.lruCacheSize = serverConfig.EVENT_PROPERTY_LRU_SIZE
        this.eventPropertiesCache = new LRU({
            max: this.lruCacheSize, // keep in memory the last 10k team+event combos we have seen
            maxAge: ONE_HOUR * 24, // cache up to 24h
            updateAgeOnGet: true,
        })
        this.eventLastSeenCache = new LRU({
            max: this.lruCacheSize, // keep in memory the last 10k team+event combos we have seen
            maxAge: ONE_HOUR * 24, // cache up to 24h
            updateAgeOnGet: true,
        })
        this.propertyDefinitionsCache = new PropertyDefinitionsCache(serverConfig, statsd)
        this.instanceSiteUrl = serverConfig.SITE_URL || 'unknown'
    }

    public async fetchTeam(teamId: number): Promise<Team | null> {
        const cachedTeam = getByAge(this.teamCache, teamId, 2 * ONE_MINUTE)
        if (cachedTeam) {
            return cachedTeam
        }

        const timeout = timeoutGuard(`Still running "fetchTeam". Timeout warning after 30 sec!`)
        try {
            const team: Team | null = (await this.db.fetchTeam(teamId)) || null
            this.teamCache.set(teamId, [team, Date.now()])
            return team
        } finally {
            clearTimeout(timeout)
        }
    }

    public async updateEventNamesAndProperties(teamId: number, event: string, properties: Properties): Promise<void> {
        if (EVENTS_WITHOUT_EVENT_DEFINITION.includes(event)) {
            return
        }

        const timer = new Date()
        const timeout = timeoutGuard('Still running "updateEventNamesAndProperties". Timeout warning after 30 sec!', {
            event: event,
        })

        try {
            const team: Team | null = await this.fetchTeam(teamId)

            if (!team) {
                return
            }
            await this.cacheEventNamesAndProperties(team.id, event)
            await Promise.all([
                this.syncEventDefinitions(team, event),
                this.syncEventProperties(team, event, properties),
                this.syncPropertyDefinitions(properties, team),
                this.setTeamIngestedEvent(team, properties),
            ])
        } finally {
            clearTimeout(timeout)
            this.statsd?.timing('updateEventNamesAndProperties', timer)
        }
    }

    private async syncEventDefinitions(team: Team, event: string) {
        const cacheKey = JSON.stringify([team.id, event])
        const cacheTime = parseInt(DateTime.now().toFormat('yyyyMMdd', { timeZone: 'UTC' }))

        if (!this.eventDefinitionsCache.get(team.id)?.has(event)) {
            status.info('Inserting new event definition with last_seen_at')
            this.eventLastSeenCache.set(cacheKey, cacheTime)
            await this.db.postgresQuery(
                `INSERT INTO analytickit_eventdefinition (id, name, volume_30_day, query_usage_30_day, team_id, last_seen_at, created_at)
VALUES ($1, $2, NULL, NULL, $3, $4, NOW()) ON CONFLICT
ON CONSTRAINT analytickit_eventdefinition_team_id_name_80fa0b87_uniq DO UPDATE SET last_seen_at=$4`,
                [new UUIDT().toString(), event, team.id, DateTime.now()],
                'insertEventDefinition'
            )
            this.eventDefinitionsCache.get(team.id)?.add(event)
        } else {
            if ((this.eventLastSeenCache.get(cacheKey) ?? 0) < cacheTime) {
                this.eventLastSeenCache.set(cacheKey, cacheTime)
                await this.db.postgresQuery(
                    `UPDATE analytickit_eventdefinition SET last_seen_at=$1 WHERE team_id=$2 AND name=$3`,
                    [DateTime.now(), team.id, event],
                    'updateEventLastSeenAt'
                )
            }
        }
    }

    private async syncEventProperties(team: Team, event: string, properties: Properties) {
        const key = JSON.stringify([team.id, event])
        let existingProperties = this.eventPropertiesCache.get(key)
        const toInsert: Array<[string, string, TeamId]> = []
        if (!existingProperties) {
            existingProperties = new Set()
            this.eventPropertiesCache.set(key, existingProperties)
        }

        for (const property of this.getPropertyKeys(properties)) {
            if (!existingProperties.has(property)) {
                existingProperties.add(property)
                toInsert.push([event, property, team.id])
            }
        }

        await this.db.postgresBulkInsert(
            `INSERT INTO analytickit_eventproperty (event, property, team_id) VALUES {VALUES} ON CONFLICT DO NOTHING`,
            toInsert,
            'insertEventProperty'
        )
    }

    private async syncPropertyDefinitions(properties: Properties, team: Team) {
        const toInsert: Array<[string, string, boolean, null, null, TeamId, PropertyType | null]> = []
        for (const key of this.getPropertyKeys(properties)) {
            const value = properties[key]
            if (this.propertyDefinitionsCache.shouldUpdate(team.id, key)) {
                const propertyType = detectPropertyDefinitionTypes(value, key)
                const isNumerical = propertyType == PropertyType.Numeric
                this.propertyDefinitionsCache.set(team.id, key, propertyType)

                toInsert.push([new UUIDT().toString(), key, isNumerical, null, null, team.id, propertyType])
            }
        }

        await this.db.postgresBulkInsert(
            `
            INSERT INTO analytickit_propertydefinition (id, name, is_numerical, volume_30_day, query_usage_30_day, team_id, property_type)
            VALUES {VALUES}
            ON CONFLICT ON CONSTRAINT analytickit_propertydefinition_team_id_name_e21599fc_uniq
            DO UPDATE SET property_type=EXCLUDED.property_type WHERE analytickit_propertydefinition.property_type IS NULL
            `,
            toInsert,
            'insertPropertyDefinition'
        )
    }

    private async setTeamIngestedEvent(team: Team, properties: Properties) {
        if (team && !team.ingested_event) {
            await this.db.postgresQuery(
                `UPDATE analytickit_team SET ingested_event = $1 WHERE id = $2`,
                [true, team.id],
                'setTeamIngestedEvent'
            )

            // First event for the team captured
            const organizationMembers = await this.db.postgresQuery(
                'SELECT distinct_id FROM analytickit_user JOIN analytickit_organizationmembership ON analytickit_user.id = analytickit_organizationmembership.user_id WHERE organization_id = $1',
                [team.organization_id],
                'analytickit_organizationmembership'
            )
            const distinctIds: { distinct_id: string }[] = organizationMembers.rows
            for (const { distinct_id } of distinctIds) {
                analytickit.capture({
                    distinctId: distinct_id,
                    event: 'first team event ingested',
                    properties: {
                        team: team.uuid,
                        sdk: properties.$lib,
                        realm: properties.realm,
                        host: properties.$host,
                    },
                    groups: {
                        project: team.uuid,
                        organization: team.organization_id,
                        instance: this.instanceSiteUrl,
                    },
                })
            }
        }
    }

    public async cacheEventNamesAndProperties(teamId: number, event: string): Promise<void> {
        let eventDefinitionsCache = this.eventDefinitionsCache.get(teamId)
        if (!eventDefinitionsCache) {
            const eventNames = await this.db.postgresQuery(
                'SELECT name FROM analytickit_eventdefinition WHERE team_id = $1',
                [teamId],
                'fetchEventDefinitions'
            )
            eventDefinitionsCache = new Set(eventNames.rows.map((r) => r.name))
            this.eventDefinitionsCache.set(teamId, eventDefinitionsCache)
        }

        if (!this.propertyDefinitionsCache.has(teamId)) {
            const eventProperties = await this.db.postgresQuery(
                'SELECT name, property_type FROM analytickit_propertydefinition WHERE team_id = $1',
                [teamId],
                'fetchPropertyDefinitions'
            )

            this.propertyDefinitionsCache.initialize(teamId, eventProperties.rows)
        }

        const cacheKey = JSON.stringify([teamId, event])
        let properties = this.eventPropertiesCache.get(cacheKey)
        if (!properties) {
            properties = new Set()
            this.eventPropertiesCache.set(cacheKey, properties)

            // The code above and below introduces a race condition. At this point we have an empty set in the cache,
            // and will be waiting for the query below to return. If at the same time, asynchronously, we start to
            // process another event with the same name for this team, `syncEventProperties` above will see the empty
            // cache and will start to insert (on conflict do nothing) all the properties for the event. This will
            // continue until either 1) the inserts will fill up the cache, or 2) the query below returns.
            // All-in-all, not the end of the world, but a slight nuisance.

            const eventProperties = await this.db.postgresQuery(
                'SELECT property FROM analytickit_eventproperty WHERE team_id = $1 AND event = $2',
                [teamId, event],
                'fetchEventProperties'
            )
            for (const { property } of eventProperties.rows) {
                properties.add(property)
            }
        }
    }

    private getPropertyKeys(properties: Properties): Array<string> {
        return Object.keys(properties).filter((key) => !NOT_SYNCED_PROPERTIES.has(key))
    }
}
