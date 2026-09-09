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


async def _create_project_with_token(client, headers, name: str = "FlightSG"):
    project_response = await client.post("/projects", json={"name": name}, headers=headers)
    project_id = project_response.json()["id"]
    token_response = await client.post(f"/projects/{project_id}/token", headers=headers)
    token = token_response.json()["token"]
    return project_id, {"Authorization": f"Bearer {token}"}


def _sample_result(
    file_path: str = "tests/login.spec.ts",
    test_title: str = "logs in",
    status: str = "passed",
    duration_ms: int = 1200,
    error_message: str | None = None,
) -> dict:
    return {
        "file_path": file_path,
        "test_title": test_title,
        "status": status,
        "duration_ms": duration_ms,
        "error_message": error_message,
    }


async def _ingest_run(client, project_id, token_headers, results, run_metadata=None):
    payload: dict = {"results": results}
    if run_metadata is not None:
        payload["run_metadata"] = run_metadata
    response = await client.post(
        f"/projects/{project_id}/runs", json=payload, headers=token_headers
    )
    return response.json()


async def _get_suite_id(client, project_id, headers) -> str:
    suites = (await client.get(f"/projects/{project_id}/suites", headers=headers)).json()
    return suites[0]["id"]


async def _get_case_id(client, project_id, suite_id, headers, test_title: str) -> str:
    cases = (
        await client.get(f"/projects/{project_id}/suites/{suite_id}/cases", headers=headers)
    ).json()
    return next(case["id"] for case in cases if case["test_title"] == test_title)


async def test_update_case_sets_display_name(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    await _ingest_run(client, project_id, token_headers, [_sample_result(test_title="logs in")])
    suite_id = await _get_suite_id(client, project_id, headers)
    case_id = await _get_case_id(client, project_id, suite_id, headers, "logs in")

    response = await client.patch(
        f"/projects/{project_id}/suites/{suite_id}/cases/{case_id}",
        json={"display_name": "Login happy path"},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Login happy path"
    assert body["test_title"] == "logs in"


async def test_update_case_does_not_change_identity_key(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    await _ingest_run(client, project_id, token_headers, [_sample_result(test_title="logs in")])
    suite_id = await _get_suite_id(client, project_id, headers)
    case_id = await _get_case_id(client, project_id, suite_id, headers, "logs in")

    await client.patch(
        f"/projects/{project_id}/suites/{suite_id}/cases/{case_id}",
        json={"display_name": "Login happy path"},
        headers=headers,
    )

    second_run = await _ingest_run(
        client, project_id, token_headers, [_sample_result(test_title="logs in")]
    )

    result = second_run["results"][0]
    assert result["case_id"] == case_id


async def test_update_case_rejects_case_not_found(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    await _ingest_run(client, project_id, token_headers, [_sample_result()])
    suite_id = await _get_suite_id(client, project_id, headers)

    response = await client.patch(
        f"/projects/{project_id}/suites/{suite_id}/cases/{uuid.uuid4()}",
        json={"display_name": "New name"},
        headers=headers,
    )

    assert response.status_code == 404


async def test_update_case_rejects_another_users_project(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, owner_headers)
    await _ingest_run(client, project_id, token_headers, [_sample_result()])
    suite_id = await _get_suite_id(client, project_id, owner_headers)
    case_id = await _get_case_id(client, project_id, suite_id, owner_headers, "logs in")

    response = await client.patch(
        f"/projects/{project_id}/suites/{suite_id}/cases/{case_id}",
        json={"display_name": "New name"},
        headers=other_headers,
    )

    assert response.status_code == 404


async def test_create_case_manually_ahead_of_ingestion(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)

    response = await client.post(
        f"/projects/{project_id}/cases",
        json={
            "file_path": "tests/checkout.spec.ts",
            "test_title": "completes checkout",
            "display_name": "Checkout flow",
        },
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["test_title"] == "completes checkout"
    assert body["display_name"] == "Checkout flow"

    suites = (await client.get(f"/projects/{project_id}/suites", headers=headers)).json()
    assert {suite["file_path"] for suite in suites} == {"tests/checkout.spec.ts"}


async def test_ingested_result_attaches_to_manually_created_case(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    created = (
        await client.post(
            f"/projects/{project_id}/cases",
            json={
                "file_path": "tests/checkout.spec.ts",
                "test_title": "completes checkout",
            },
            headers=headers,
        )
    ).json()

    run = await _ingest_run(
        client,
        project_id,
        token_headers,
        [_sample_result(file_path="tests/checkout.spec.ts", test_title="completes checkout")],
    )

    assert run["results"][0]["case_id"] == created["id"]

    suites = (await client.get(f"/projects/{project_id}/suites", headers=headers)).json()
    assert len(suites) == 1
    cases = (
        await client.get(
            f"/projects/{project_id}/suites/{suites[0]['id']}/cases", headers=headers
        )
    ).json()
    assert len(cases) == 1


async def test_create_case_rejects_duplicate(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)
    await client.post(
        f"/projects/{project_id}/cases",
        json={"file_path": "tests/checkout.spec.ts", "test_title": "completes checkout"},
        headers=headers,
    )

    response = await client.post(
        f"/projects/{project_id}/cases",
        json={"file_path": "tests/checkout.spec.ts", "test_title": "completes checkout"},
        headers=headers,
    )

    assert response.status_code == 409


async def test_create_case_rejects_another_users_project(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, owner_headers)

    response = await client.post(
        f"/projects/{project_id}/cases",
        json={"file_path": "tests/checkout.spec.ts", "test_title": "completes checkout"},
        headers=other_headers,
    )

    assert response.status_code == 404


async def test_create_case_rejects_missing_auth(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)

    response = await client.post(
        f"/projects/{project_id}/cases",
        json={"file_path": "tests/checkout.spec.ts", "test_title": "completes checkout"},
    )

    assert response.status_code == 401
