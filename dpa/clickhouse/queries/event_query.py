from typing import Dict, List, Optional, Tuple, Union

from analytickit.models.filters.filter import Filter
from analytickit.models.filters.path_filter import PathFilter
from analytickit.models.filters.retention_filter import RetentionFilter
from analytickit.models.filters.session_recordings_filter import SessionRecordingsFilter
from analytickit.models.filters.stickiness_filter import StickinessFilter
from analytickit.models.property import PropertyName
from analytickit.models.team import Team
from analytickit.queries.event_query.event_query import EventQuery
from dpa.clickhouse.materialized_columns.columns import ColumnName
from dpa.clickhouse.queries.column_optimizer import EnterpriseColumnOptimizer
from dpa.clickhouse.queries.groups_join_query import GroupsJoinQuery


class EnterpriseEventQuery(EventQuery):
    _column_optimizer: EnterpriseColumnOptimizer

    def __init__(
        self,
        filter: Union[Filter, PathFilter, RetentionFilter, StickinessFilter, SessionRecordingsFilter],
        team: Team,
        round_interval=False,
        should_join_distinct_ids=False,
        should_join_persons=False,
        # Extra events/person table columns to fetch since parent query needs them
        extra_fields: List[ColumnName] = [],
        extra_event_properties: List[PropertyName] = [],
        extra_person_fields: List[ColumnName] = [],
        override_aggregate_users_by_distinct_id: Optional[bool] = None,
        using_person_on_events: bool = False,
        **kwargs,
    ) -> None:
        super().__init__(
            filter=filter,
            team=team,
            round_interval=round_interval,
            should_join_distinct_ids=should_join_distinct_ids,
            should_join_persons=should_join_persons,
            extra_fields=extra_fields,
            extra_event_properties=extra_event_properties,
            extra_person_fields=extra_person_fields,
            override_aggregate_users_by_distinct_id=override_aggregate_users_by_distinct_id,
            using_person_on_events=using_person_on_events,
            **kwargs,
        )

        self._column_optimizer = EnterpriseColumnOptimizer(self._filter, self._team_id)

    def _get_groups_query(self) -> Tuple[str, Dict]:
        return GroupsJoinQuery(
            self._filter, self._team_id, self._column_optimizer, using_person_on_events=self._using_person_on_events
        ).get_join_query()
