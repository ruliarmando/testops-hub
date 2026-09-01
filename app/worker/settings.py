from arq.connections import RedisSettings

from app.core.config import get_settings
from app.worker.tasks import ping


class WorkerSettings:
    functions = [ping]
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
