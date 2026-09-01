from fastapi_users.authentication import AuthenticationBackend, BearerTransport

from app.auth.strategy import get_access_token_strategy

bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_access_token_strategy,
)
