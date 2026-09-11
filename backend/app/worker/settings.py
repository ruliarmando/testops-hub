from arq.connections import RedisSettings

from app.core.config import get_settings
from app.worker.tasks import ping, process_test_run


class WorkerSettings:
    functions = [ping, process_test_run]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
