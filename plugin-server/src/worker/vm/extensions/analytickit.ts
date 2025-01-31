import { Properties } from '@analytickit/plugin-scaffold'
import crypto from 'crypto'
import { DateTime } from 'luxon'
import { Hub, PluginConfig, RawEventMessage } from 'types'

import { UUIDT } from '../../../utils/utils'
import { ApiExtension, createApi } from './api'

const { version } = require('../../../../package.json')

interface InternalData {
    distinct_id: string
    event: string
    timestamp: string
    properties: Properties
    team_id: number
    uuid: string
}

export interface Dummyanalytickit {
    capture(event: string, properties?: Record<string, any>): Promise<void>
    api: ApiExtension
}

async function queueEvent(hub: Hub, pluginConfig: PluginConfig, data: InternalData): Promise<void> {
    const partitionKeyHash = crypto.createHash('sha256')
    partitionKeyHash.update(`${data.team_id}:${data.distinct_id}`)
    const partitionKey = partitionKeyHash.digest('hex')

    await hub.kafkaProducer.queueMessage({
        topic: hub.KAFKA_CONSUMPTION_TOPIC!,
        messages: [
            {
                key: partitionKey,
                value: JSON.stringify({
                    distinct_id: data.distinct_id,
                    ip: '',
                    site_url: '',
                    data: JSON.stringify(data),
                    team_id: pluginConfig.team_id,
                    now: data.timestamp,
                    sent_at: data.timestamp,
                    uuid: data.uuid,
                } as RawEventMessage),
            },
        ],
    })
}

export function createanalytickit(hub: Hub, pluginConfig: PluginConfig): Dummyanalytickit {
    const distinctId = pluginConfig.plugin?.name || `plugin-id-${pluginConfig.plugin_id}`

    return {
        capture: async (event, properties = {}) => {
            const { timestamp = DateTime.utc().toISO(), distinct_id = distinctId, ...otherProperties } = properties
            const data: InternalData = {
                distinct_id,
                event,
                timestamp,
                properties: {
                    $lib: 'analytickit-plugin-server',
                    $lib_version: version,
                    distinct_id,
                    ...otherProperties,
                },
                team_id: pluginConfig.team_id,
                uuid: new UUIDT().toString(),
            }
            await queueEvent(hub, pluginConfig, data)
            hub.statsd?.increment('vm_analytickit_extension_capture_called')
        },
        api: createApi(hub, pluginConfig),
    }
}
