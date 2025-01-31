from typing import Any, Dict, Optional

from rest_framework.request import Request

from analytickit.constants import INSIGHT_PATHS
from analytickit.models.filters.base_filter import BaseFilter
from analytickit.models.filters.mixins.common import (
    BreakdownMixin,
    DateMixin,
    EntitiesMixin,
    FilterTestAccountsMixin,
    IncludeRecordingsMixin,
    InsightMixin,
    LimitMixin,
    OffsetMixin,
)
from analytickit.models.filters.mixins.funnel import FunnelCorrelationMixin, FunnelPersonsStepMixin, FunnelWindowMixin
from analytickit.models.filters.mixins.groups import GroupsAggregationMixin
from analytickit.models.filters.mixins.interval import IntervalMixin
from analytickit.models.filters.mixins.paths import (
    ComparatorDerivedMixin,
    EndPointMixin,
    FunnelPathsMixin,
    LocalPathCleaningFiltersMixin,
    PathGroupingMixin,
    PathLimitsMixin,
    PathPersonsMixin,
    PathReplacementMixin,
    PathStepLimitMixin,
    PropTypeDerivedMixin,
    StartPointMixin,
    TargetEventDerivedMixin,
    TargetEventsMixin,
)
from analytickit.models.filters.mixins.property import PropertyMixin
from analytickit.models.filters.mixins.simplify import SimplifyFilterMixin


class PathFilter(
    StartPointMixin,
    EndPointMixin,
    TargetEventDerivedMixin,
    ComparatorDerivedMixin,
    PropTypeDerivedMixin,
    PropertyMixin,
    IntervalMixin,
    InsightMixin,
    FilterTestAccountsMixin,
    DateMixin,
    BreakdownMixin,
    EntitiesMixin,
    PathStepLimitMixin,
    FunnelPathsMixin,
    TargetEventsMixin,
    FunnelWindowMixin,
    FunnelPersonsStepMixin,
    PathGroupingMixin,
    PathReplacementMixin,
    LocalPathCleaningFiltersMixin,
    PathPersonsMixin,
    LimitMixin,
    OffsetMixin,
    PathLimitsMixin,
    GroupsAggregationMixin,
    FunnelCorrelationMixin,  # Typing pain because ColumnOptimizer expects a uniform filter
    SimplifyFilterMixin,
    IncludeRecordingsMixin,
    # TODO: proper fix for EventQuery abstraction
    BaseFilter,
):
    def __init__(self, data: Optional[Dict[str, Any]] = None, request: Optional[Request] = None, **kwargs) -> None:
        if data:
            data["insight"] = INSIGHT_PATHS
        else:
            data = {"insight": INSIGHT_PATHS}
        super().__init__(data, request, **kwargs)
