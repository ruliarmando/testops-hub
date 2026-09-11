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


async def test_ingest_run_creates_run_with_all_results(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)

    response = await client.post(
        f"/projects/{project_id}/runs",
        json={
            "results": [
                _sample_result(test_title="logs in", status="passed"),
                _sample_result(
                    test_title="rejects bad password",
                    status="failed",
                    error_message="AssertionError: expected 200, got 401",
                ),
            ]
        },
        headers=token_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["project_id"] == project_id
    assert len(body["results"]) == 2
    statuses = {r["test_title"]: r["status"] for r in body["results"]}
    assert statuses == {"logs in": "passed", "rejects bad password": "failed"}
    failed_result = next(r for r in body["results"] if r["test_title"] == "rejects bad password")
    assert failed_result["error_message"] == "AssertionError: expected 200, got 401"


async def test_ingest_run_accepts_optional_run_metadata(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)

    response = await client.post(
        f"/projects/{project_id}/runs",
        json={
            "results": [_sample_result()],
            "run_metadata": {"branch": "main", "commit": "abc123"},
        },
        headers=token_headers,
    )

    assert response.status_code == 201
    assert response.json()["run_metadata"] == {"branch": "main", "commit": "abc123"}


async def test_ingest_run_reuses_existing_suite_and_case_across_runs(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    payload = {"results": [_sample_result()]}

    first_response = await client.post(
        f"/projects/{project_id}/runs", json=payload, headers=token_headers
    )
    second_response = await client.post(
        f"/projects/{project_id}/runs", json=payload, headers=token_headers
    )

    assert first_response.status_code == 201
    assert second_response.status_code == 201

    first_run_id = first_response.json()["id"]
    second_run_id = second_response.json()["id"]
    assert first_run_id != second_run_id

    first_case_id = first_response.json()["results"][0]["case_id"]
    second_case_id = second_response.json()["results"][0]["case_id"]
    assert first_case_id == second_case_id


async def test_ingest_run_rejects_missing_status_field(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)

    response = await client.post(
        f"/projects/{project_id}/runs",
        json={
            "results": [
                {
                    "file_path": "tests/login.spec.ts",
                    "test_title": "logs in",
                    "duration_ms": 100,
                }
            ]
        },
        headers=token_headers,
    )

    assert response.status_code == 422


async def test_ingest_run_rejects_missing_token(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)

    response = await client.post(f"/projects/{project_id}/runs", json={"results": []})

    assert response.status_code == 401


async def test_ingest_run_rejects_invalid_token(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)

    response = await client.post(
        f"/projects/{project_id}/runs",
        json={"results": []},
        headers={"Authorization": "Bearer not-a-real-token"},
    )

    assert response.status_code == 401


async def test_ingest_run_rejects_token_scoped_to_a_different_project(client):
    headers = await _register_and_login(client)
    _, project_a_headers = await _create_project_with_token(client, headers, name="Project A")
    project_b_id, _ = await _create_project_with_token(client, headers, name="Project B")

    response = await client.post(
        f"/projects/{project_b_id}/runs",
        json={"results": []},
        headers=project_a_headers,
    )

    assert response.status_code == 401
