from analytickit.infi.clickhouse_orm import migrations

from analytickit.models.person.sql import KAFKA_PERSONS_TABLE_SQL, PERSONS_TABLE_MV_SQL
from analytickit.settings import CLICKHOUSE_CLUSTER

operations = [
    migrations.RunSQL(f"DROP TABLE person_mv ON CLUSTER '{CLICKHOUSE_CLUSTER}'"),
    migrations.RunSQL(f"DROP TABLE kafka_person ON CLUSTER '{CLICKHOUSE_CLUSTER}'"),
    migrations.RunSQL(
        f"ALTER TABLE person ON CLUSTER '{CLICKHOUSE_CLUSTER}' ADD COLUMN IF NOT EXISTS is_deleted Int8 DEFAULT 0"
    ),
    migrations.RunSQL(KAFKA_PERSONS_TABLE_SQL()),
    migrations.RunSQL(PERSONS_TABLE_MV_SQL),
]
