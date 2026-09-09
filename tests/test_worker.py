import uuid

from app.worker.tasks import ping, process_test_run


async def test_ping_job_runs_directly():
    result = await ping({})

    assert result == "pong"


async def test_process_test_run_job_runs_directly():
    run_id = str(uuid.uuid4())

    result = await process_test_run({}, run_id)

    assert result == run_id
