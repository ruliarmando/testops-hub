from fastapi_users.authentication import JWTStrategy

from app.core.config import get_settings

ACCESS_TOKEN_AUDIENCE = ["testops-hub:auth"]
REFRESH_TOKEN_AUDIENCE = ["testops-hub:refresh"]


def _build_strategy(lifetime_seconds: int, token_audience: list[str]) -> JWTStrategy:
    return JWTStrategy(
        secret=get_settings().secret_key,
        lifetime_seconds=lifetime_seconds,
        token_audience=token_audience,
    )


def get_access_token_strategy() -> JWTStrategy:
    return _build_strategy(get_settings().access_token_lifetime_seconds, ACCESS_TOKEN_AUDIENCE)


def get_refresh_token_strategy() -> JWTStrategy:
    return _build_strategy(get_settings().refresh_token_lifetime_seconds, REFRESH_TOKEN_AUDIENCE)
