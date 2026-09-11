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


async def test_list_runs_returns_most_recent_first(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    first_run = await _ingest_run(
        client,
        project_id,
        token_headers,
        [_sample_result(status="passed"), _sample_result(test_title="other", status="failed")],
    )
    second_run = await _ingest_run(client, project_id, token_headers, [_sample_result()])

    response = await client.get(f"/projects/{project_id}/runs", headers=headers)

    assert response.status_code == 200
    body = response.json()
    run_ids = [run["id"] for run in body]
    assert run_ids == [second_run["id"], first_run["id"]]
    pass_rates = {run["id"]: run["pass_rate"] for run in body}
    assert pass_rates[first_run["id"]] == 50.0
    assert pass_rates[second_run["id"]] == 100.0


async def test_list_runs_rejects_another_users_project(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, owner_headers)

    response = await client.get(f"/projects/{project_id}/runs", headers=other_headers)

    assert response.status_code == 404


async def test_list_runs_rejects_missing_auth(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)

    response = await client.get(f"/projects/{project_id}/runs")

    assert response.status_code == 401


async def test_read_run_includes_all_results_and_pass_rate(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    run = await _ingest_run(
        client,
        project_id,
        token_headers,
        [
            _sample_result(test_title="logs in", status="passed"),
            _sample_result(
                test_title="rejects bad password",
                status="failed",
                error_message="AssertionError: expected 200, got 401",
            ),
        ],
    )

    response = await client.get(f"/projects/{project_id}/runs/{run['id']}", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == run["id"]
    assert len(body["results"]) == 2
    statuses = {r["test_title"]: r["status"] for r in body["results"]}
    assert statuses == {"logs in": "passed", "rejects bad password": "failed"}
    failed_result = next(r for r in body["results"] if r["test_title"] == "rejects bad password")
    assert failed_result["error_message"] == "AssertionError: expected 200, got 401"
    assert body["pass_rate"] == 50.0


async def test_read_run_pass_rate_is_null_when_there_are_no_results(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    run = await _ingest_run(client, project_id, token_headers, [])

    response = await client.get(f"/projects/{project_id}/runs/{run['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json()["pass_rate"] is None


async def test_read_run_rejects_run_id_not_found(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)

    response = await client.get(f"/projects/{project_id}/runs/{uuid.uuid4()}", headers=headers)

    assert response.status_code == 404


async def test_read_run_rejects_another_users_project(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, owner_headers)
    run = await _ingest_run(client, project_id, token_headers, [_sample_result()])

    response = await client.get(f"/projects/{project_id}/runs/{run['id']}", headers=other_headers)

    assert response.status_code == 404


async def test_read_run_rejects_run_belonging_to_a_different_project(client):
    headers = await _register_and_login(client)
    project_a_id, project_a_token_headers = await _create_project_with_token(
        client, headers, name="Project A"
    )
    project_b_id, _ = await _create_project_with_token(client, headers, name="Project B")
    run = await _ingest_run(client, project_a_id, project_a_token_headers, [_sample_result()])

    response = await client.get(f"/projects/{project_b_id}/runs/{run['id']}", headers=headers)

    assert response.status_code == 404


async def test_list_suites_returns_a_projects_suites(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    await _ingest_run(
        client,
        project_id,
        token_headers,
        [
            _sample_result(file_path="tests/login.spec.ts"),
            _sample_result(file_path="tests/checkout.spec.ts", test_title="completes checkout"),
        ],
    )

    response = await client.get(f"/projects/{project_id}/suites", headers=headers)

    assert response.status_code == 200
    file_paths = {suite["file_path"] for suite in response.json()}
    assert file_paths == {"tests/login.spec.ts", "tests/checkout.spec.ts"}


async def test_list_suites_rejects_another_users_project(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, owner_headers)

    response = await client.get(f"/projects/{project_id}/suites", headers=other_headers)

    assert response.status_code == 404


async def test_list_cases_returns_a_suites_cases(client):
    headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, headers)
    await _ingest_run(
        client,
        project_id,
        token_headers,
        [
            _sample_result(test_title="logs in"),
            _sample_result(test_title="rejects bad password"),
        ],
    )
    suite_id = (await client.get(f"/projects/{project_id}/suites", headers=headers)).json()[0][
        "id"
    ]

    response = await client.get(f"/projects/{project_id}/suites/{suite_id}/cases", headers=headers)

    assert response.status_code == 200
    test_titles = {case["test_title"] for case in response.json()}
    assert test_titles == {"logs in", "rejects bad password"}


async def test_list_cases_rejects_suite_not_found(client):
    headers = await _register_and_login(client)
    project_id, _ = await _create_project_with_token(client, headers)

    response = await client.get(
        f"/projects/{project_id}/suites/{uuid.uuid4()}/cases", headers=headers
    )

    assert response.status_code == 404


async def test_list_cases_rejects_suite_belonging_to_a_different_project(client):
    headers = await _register_and_login(client)
    project_a_id, project_a_token_headers = await _create_project_with_token(
        client, headers, name="Project A"
    )
    project_b_id, _ = await _create_project_with_token(client, headers, name="Project B")
    await _ingest_run(client, project_a_id, project_a_token_headers, [_sample_result()])
    suite_id = (await client.get(f"/projects/{project_a_id}/suites", headers=headers)).json()[0][
        "id"
    ]

    response = await client.get(
        f"/projects/{project_b_id}/suites/{suite_id}/cases", headers=headers
    )

    assert response.status_code == 404


async def test_list_cases_rejects_another_users_project(client):
    owner_headers = await _register_and_login(client)
    other_headers = await _register_and_login(client)
    project_id, token_headers = await _create_project_with_token(client, owner_headers)
    await _ingest_run(client, project_id, token_headers, [_sample_result()])
    suite_id = (await client.get(f"/projects/{project_id}/suites", headers=owner_headers)).json()[
        0
    ]["id"]

    response = await client.get(
        f"/projects/{project_id}/suites/{suite_id}/cases", headers=other_headers
    )

    assert response.status_code == 404
