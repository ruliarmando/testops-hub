from app.worker.tasks import ping


async def test_ping_job_runs_directly():
    result = await ping({})

    assert result == "pong"
