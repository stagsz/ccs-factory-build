# Show the slot count on the dashboard

- Job: j-20261016-002
- Branch: factory/j-20261016-002-show-the-slot-count-on-the-dashboard
- Source: backlog
- Created: 2026-10-16T09:59:18.591Z

## Request

dashboard/index.html already fetches /board.json and /config.json. Add a small "Active n/max" indicator to the dashboard header, where max is config.parallel.maxJobs (1 when unset) and n counts jobs in the active stages queued, spec, spec-approval, build, review, rework and approve (needs-human, merged and failed use no slot), matching ACTIVE_STAGES in scripts/lib/board.mjs. Keep the existing look (reuse the header's existing styles, no new dependencies). Add a drift guard to tests/dashboard.test.mjs, like the existing STAGES guard, asserting the dashboard's active-stage list equals the exported ACTIVE_STAGES. Only dashboard/index.html and tests/dashboard.test.mjs should change.
