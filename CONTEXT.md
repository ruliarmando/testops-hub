# TestOps Hub

A platform for ingesting, browsing, and analyzing automated E2E test results (see [PLAN.md](./PLAN.md) for phased scope).

## Language

**Run metadata**:
The optional `branch`, `commit`, and `ci_run_url` fields a reporter may attach to a test run (stored in `TestRun.run_metadata`, otherwise free-form JSON). All three are optional — a run with none of them still displays, just without those badges/filters.
_Avoid_: metadata (bare), run context

**Result bucket**:
The two-state grouping used to filter run history by outcome: "All passed" (`pass_rate === 100`) vs "Has failures" (`pass_rate < 100`, including a run with zero results). Deliberately coarser than flaky classification — see Phase 3 in [PLAN.md](./PLAN.md) for the finer-grained flaky/stable/frequently-failing taxonomy, which result bucket is not a substitute for.
_Avoid_: run status, status bucket
