from typing import Any, List

import structlog

from analytickit.client import sync_execute
from analytickit.models.event.sql import EVENTS_DATA_TABLE
from analytickit.models.person import Person, PersonDistinctId
from analytickit.models.team import Team
from analytickit.settings import CLEAR_CLICKHOUSE_REMOVED_DATA_SCHEDULE_CRON, CLICKHOUSE_CLUSTER
from analytickit.utils import get_crontab

logger = structlog.get_logger(__name__)

# Note: Session recording, dead letter queue, logs deletion will be handled by TTL
TABLES_TO_DELETE_FROM = lambda: [
    EVENTS_DATA_TABLE(),
    "person",
    "person_distinct_id",
    "person_distinct_id2",
    "groups",
    "cohortpeople",
    "person_static_cohort",
    "plugin_log_entries",
]


def delete_bulky_postgres_data(team_ids: List[int]):
    "Efficiently delete large tables for teams from postgres. Using normal CASCADE delete here can time out"

    _raw_delete(PersonDistinctId.objects.filter(team_id__in=team_ids))
    _raw_delete(Person.objects.filter(team_id__in=team_ids))


def _raw_delete(queryset: Any):
    "Issues a single DELETE statement for the queryset"
    queryset._raw_delete(queryset.db)


def delete_teams_clickhouse_data(team_ids: List[int]):
    logger.info(
        f"Deleting teams data from clickhouse using background mutations.",
        team_ids=team_ids,
        tables=TABLES_TO_DELETE_FROM(),
    )
    for table in TABLES_TO_DELETE_FROM():
        sync_execute(
            f"ALTER TABLE {table} ON CLUSTER '{CLICKHOUSE_CLUSTER}' DELETE WHERE team_id IN %(team_ids)s",
            {"team_ids": team_ids},
        )


def deleted_teams_with_clickhouse_data() -> List[int]:
    '''
    this function helps you find team IDs that were present in the ClickHouse database's 
    events table but are no longer present in the Team model in Django. 
    It returns a list of these "deleted" team IDs.
    
    Note: This function is only useful if you have already deleted the team from Django. 
    If you have not deleted the team from Django, you can safely ignore this function.
    You can use /api/projects/<pk> (pk is team_id from analytickit_team. 
    project in the api is associated with team in Postgres)
    '''
    valid_team_ids = set(Team.objects.all().values_list("pk", flat=True))
    clickhouse_teams_result = sync_execute("SELECT DISTINCT team_id FROM events")
    clickhouse_team_ids = set(row[0] for row in clickhouse_teams_result)
    return list(clickhouse_team_ids - valid_team_ids)


def delete_clickhouse_data_for_deleted_teams():
    team_ids = deleted_teams_with_clickhouse_data()

    if len(team_ids) > 0:
        delete_teams_clickhouse_data(team_ids)
    else:
        logger.debug("No need to delete any data from clickhouse")


def is_clickhouse_data_cron_enabled() -> bool:
    return get_crontab(CLEAR_CLICKHOUSE_REMOVED_DATA_SCHEDULE_CRON) is not None
