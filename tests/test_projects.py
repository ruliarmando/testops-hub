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


async def test_create_project_returns_it_owned_by_the_current_user(client):
    headers = await _register_and_login(client)

    response = await client.post("/projects", json={"name": "FlightSG"}, headers=headers)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "FlightSG"
    assert body["id"]
    assert body["owner_id"]


async def test_list_projects_returns_only_projects_owned_by_the_current_user(client):
    headers_a = await _register_and_login(client)
    headers_b = await _register_and_login(client)
    await client.post("/projects", json={"name": "Project A"}, headers=headers_a)
    await client.post("/projects", json={"name": "Project B1"}, headers=headers_b)
    await client.post("/projects", json={"name": "Project B2"}, headers=headers_b)

    response = await client.get("/projects", headers=headers_b)

    assert response.status_code == 200
    names = {project["name"] for project in response.json()}
    assert names == {"Project B1", "Project B2"}


async def test_read_project_returns_a_project_owned_by_the_current_user(client):
    headers = await _register_and_login(client)
    create_response = await client.post("/projects", json={"name": "FlightSG"}, headers=headers)
    project_id = create_response.json()["id"]

    response = await client.get(f"/projects/{project_id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["name"] == "FlightSG"


async def test_update_project_renames_it(client):
    headers = await _register_and_login(client)
    create_response = await client.post("/projects", json={"name": "Old Name"}, headers=headers)
    project_id = create_response.json()["id"]

    response = await client.patch(
        f"/projects/{project_id}", json={"name": "New Name"}, headers=headers
    )

    assert response.status_code == 200
    assert response.json()["name"] == "New Name"

    get_response = await client.get(f"/projects/{project_id}", headers=headers)
    assert get_response.json()["name"] == "New Name"


async def test_delete_project_removes_it(client):
    headers = await _register_and_login(client)
    create_response = await client.post("/projects", json={"name": "FlightSG"}, headers=headers)
    project_id = create_response.json()["id"]

    response = await client.delete(f"/projects/{project_id}", headers=headers)

    assert response.status_code == 204

    get_response = await client.get(f"/projects/{project_id}", headers=headers)
    assert get_response.status_code == 404


async def test_read_project_owned_by_another_user_is_rejected(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    create_response = await client.post(
        "/projects", json={"name": "FlightSG"}, headers=owner_headers
    )
    project_id = create_response.json()["id"]

    response = await client.get(f"/projects/{project_id}", headers=other_headers)

    assert response.status_code == 404


async def test_update_project_owned_by_another_user_is_rejected(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    create_response = await client.post(
        "/projects", json={"name": "FlightSG"}, headers=owner_headers
    )
    project_id = create_response.json()["id"]

    response = await client.patch(
        f"/projects/{project_id}", json={"name": "Hijacked"}, headers=other_headers
    )

    assert response.status_code == 404

    get_response = await client.get(f"/projects/{project_id}", headers=owner_headers)
    assert get_response.json()["name"] == "FlightSG"


async def test_delete_project_owned_by_another_user_is_rejected(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    create_response = await client.post(
        "/projects", json={"name": "FlightSG"}, headers=owner_headers
    )
    project_id = create_response.json()["id"]

    response = await client.delete(f"/projects/{project_id}", headers=other_headers)

    assert response.status_code == 404

    get_response = await client.get(f"/projects/{project_id}", headers=owner_headers)
    assert get_response.status_code == 200


async def test_project_endpoints_reject_missing_token(client):
    assert (await client.get("/projects")).status_code == 401
    assert (await client.post("/projects", json={"name": "X"})).status_code == 401

    random_id = uuid.uuid4()
    assert (await client.get(f"/projects/{random_id}")).status_code == 401
    assert (await client.patch(f"/projects/{random_id}", json={"name": "X"})).status_code == 401
    assert (await client.delete(f"/projects/{random_id}")).status_code == 401
