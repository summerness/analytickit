from analytickit.infi.clickhouse_orm import migrations

from analytickit.clickhouse.dead_letter_queue import DEAD_LETTER_QUEUE_TABLE_MV_SQL, KAFKA_DEAD_LETTER_QUEUE_TABLE_SQL
from analytickit.settings.data_stores import CLICKHOUSE_CLUSTER

operations = [
    migrations.RunSQL(f"DROP TABLE IF EXISTS events_dead_letter_queue_mv ON CLUSTER '{CLICKHOUSE_CLUSTER}'"),
    migrations.RunSQL(f"DROP TABLE IF EXISTS kafka_events_dead_letter_queue ON CLUSTER '{CLICKHOUSE_CLUSTER}'"),
    migrations.RunSQL(KAFKA_DEAD_LETTER_QUEUE_TABLE_SQL()),
    migrations.RunSQL(DEAD_LETTER_QUEUE_TABLE_MV_SQL),
]
