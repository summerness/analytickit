from analytickit.settings import EE_AVAILABLE

if EE_AVAILABLE:
    from dpa.clickhouse.queries.stickiness import ClickhouseStickiness as Stickiness
    from dpa.clickhouse.queries.stickiness import ClickhouseStickinessActors as StickinessActors
else:
    from analytickit.queries.stickiness.stickiness import Stickiness  # type: ignore
    from analytickit.queries.stickiness.stickiness_actors import StickinessActors  # type: ignore
