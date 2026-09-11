import uuid


async def _register_and_login(client, email: str | None = None, password: str = "s3cret-password"):
    email = email or f"{uuid.uuid4()}@example.com"
    await client.post("/auth/register", json={"email": email, "password": password})
    login_response = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    access_token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


async def _create_project(client, headers, name: str = "FlightSG") -> str:
    response = await client.post("/projects", json={"name": name}, headers=headers)
    return response.json()["id"]


async def test_owner_can_generate_a_project_token(client):
    headers = await _register_and_login(client)
    project_id = await _create_project(client, headers)

    response = await client.post(f"/projects/{project_id}/token", headers=headers)

    assert response.status_code == 200
    assert response.json()["token"]


async def test_owner_can_view_masked_token_after_generating_it(client):
    headers = await _register_and_login(client)
    project_id = await _create_project(client, headers)
    create_response = await client.post(f"/projects/{project_id}/token", headers=headers)
    raw_token = create_response.json()["token"]

    response = await client.get(f"/projects/{project_id}/token", headers=headers)

    assert response.status_code == 200
    masked_token = response.json()["masked_token"]
    assert raw_token not in masked_token
    assert masked_token.endswith(raw_token[-4:])


async def test_viewing_token_before_generating_one_is_not_found(client):
    headers = await _register_and_login(client)
    project_id = await _create_project(client, headers)

    response = await client.get(f"/projects/{project_id}/token", headers=headers)

    assert response.status_code == 404


async def test_regenerating_a_token_invalidates_the_previous_one(client):
    headers = await _register_and_login(client)
    project_id = await _create_project(client, headers)
    first_response = await client.post(f"/projects/{project_id}/token", headers=headers)
    first_token = first_response.json()["token"]

    second_response = await client.post(f"/projects/{project_id}/token", headers=headers)
    second_token = second_response.json()["token"]

    assert second_token != first_token

    old_token_response = await client.post(
        f"/projects/{project_id}/runs",
        json={"results": []},
        headers={"Authorization": f"Bearer {first_token}"},
    )
    assert old_token_response.status_code == 401

    new_token_response = await client.post(
        f"/projects/{project_id}/runs",
        json={"results": []},
        headers={"Authorization": f"Bearer {second_token}"},
    )
    assert new_token_response.status_code == 201


async def test_project_token_endpoints_reject_another_users_project(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    project_id = await _create_project(client, owner_headers)

    create_response = await client.post(f"/projects/{project_id}/token", headers=other_headers)
    assert create_response.status_code == 404

    read_response = await client.get(f"/projects/{project_id}/token", headers=other_headers)
    assert read_response.status_code == 404


async def test_project_token_endpoints_reject_missing_user_token(client):
    project_id = uuid.uuid4()

    assert (await client.post(f"/projects/{project_id}/token")).status_code == 401
    assert (await client.get(f"/projects/{project_id}/token")).status_code == 401
