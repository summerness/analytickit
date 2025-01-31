from analytickit.infi.clickhouse_orm import migrations

from analytickit.models.event.sql import EVENTS_TABLE_SQL
from analytickit.settings import CLICKHOUSE_CLUSTER, CLICKHOUSE_DATABASE

operations = [
    migrations.RunSQL(f"CREATE DATABASE IF NOT EXISTS {CLICKHOUSE_DATABASE} ON CLUSTER '{CLICKHOUSE_CLUSTER}'"),
    migrations.RunSQL(EVENTS_TABLE_SQL()),
]
