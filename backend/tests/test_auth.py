import uuid

from fastapi_users.jwt import generate_jwt

from app.auth.strategy import ACCESS_TOKEN_AUDIENCE
from app.core.config import get_settings


async def _register(client, email: str | None = None, password: str = "s3cret-password"):
    email = email or f"{uuid.uuid4()}@example.com"
    response = await client.post(
        "/auth/register",
        json={"email": email, "password": password},
    )
    return response, email, password


async def test_register_creates_user_with_hashed_password(client):
    response, email, _ = await _register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == email
    assert "password" not in body
    assert "hashed_password" not in body


async def test_login_with_valid_credentials_returns_access_and_refresh_tokens(client):
    _, email, password = await _register(client)

    response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


async def test_login_with_invalid_credentials_is_rejected(client):
    _, email, _ = await _register(client)

    response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": "wrong-password"},
    )

    assert response.status_code == 400


async def test_protected_endpoint_returns_current_user_identity(client):
    _, email, password = await _register(client)
    login_response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    access_token = login_response.json()["access_token"]

    response = await client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == email


async def test_protected_endpoint_rejects_missing_token(client):
    response = await client.get("/users/me")

    assert response.status_code == 401


async def test_protected_endpoint_rejects_invalid_token(client):
    response = await client.get(
        "/users/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 401


async def test_protected_endpoint_rejects_refresh_token_used_as_access_token(client):
    _, email, password = await _register(client)
    login_response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    refresh_token = login_response.json()["refresh_token"]

    response = await client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )

    assert response.status_code == 401


async def test_refresh_token_issues_new_access_token(client):
    _, email, password = await _register(client)
    login_response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    refresh_token = login_response.json()["refresh_token"]

    response = await client.post("/auth/jwt/refresh", json={"refresh_token": refresh_token})

    assert response.status_code == 200
    new_access_token = response.json()["access_token"]
    assert new_access_token

    me_response = await client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {new_access_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == email


async def test_refresh_endpoint_rejects_access_token(client):
    _, email, password = await _register(client)
    login_response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    access_token = login_response.json()["access_token"]

    response = await client.post("/auth/jwt/refresh", json={"refresh_token": access_token})

    assert response.status_code == 401


async def test_protected_endpoint_rejects_expired_token(client):
    expired_token = generate_jwt(
        {"sub": str(uuid.uuid4()), "aud": ACCESS_TOKEN_AUDIENCE},
        get_settings().secret_key,
        lifetime_seconds=-1,
    )

    response = await client.get(
        "/users/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401
