# Dashboard Worker CPU investigation — 2026-10-30

The supplied export contains 345 records, including 307 invocation records,
from 16:36:01 to 17:35:23 Argentina time (19:36:01–20:35:23 UTC).
Exception messages can repeat the same invocation; they must not be counted as
additional failed requests. All invocation records identify deployment
`072d2985-8516-4374-9240-004db21fd2e2`.

| Invocation group           | Invocations | exceededCpu | CPU min / median / max (ms) |
| -------------------------- | ----------: | ----------: | --------------------------- |
| `/api/generation-queue`    |         117 |          16 | 4 / 9 / 79                  |
| `/current-projects`        |           6 |           6 | 10 / 10 / 10                |
| Other page routes          |          17 |           5 | varies                      |
| `/api/videos/14/alignment` |         105 |           0 | 4 / 8 / 23                  |
| `/api/videos/14/voices`    |          33 |           0 | 5 / 10 / 22                 |
| Scheduled reconciliation   |          12 |           0 | 2 / 3 / 7                   |

Overall: 279 successful invocations, 27 `exceededCpu`, and one canceled
alignment request. This export contains no evidence of memory exhaustion.

## Findings

- Idle generations do not mean idle HTTP traffic. The persistent shell polls
  the queue every minute when idle, or every two minutes following an error.
  Queue CPU failures continued during the otherwise idle period.
- Requests with `rsc: 1` and `next-router-prefetch: 1` explicitly identify
  speculative navigation. Seven CPU failures were speculative page requests.
  Around 17:33:54 Argentina time, several menu destinations were prefetched.
- `/current-projects` failed in two prefetched requests, one actual RSC
  navigation, and three document requests. The failure therefore also affected
  direct page loads, independently of prefetching.
- The current-projects server page only returns a client component. Its data
  fetching starts in browser effects. Shared framework work, authentication,
  RSC handling, and initial HTML rendering remain on the Worker.
- Alignment updates already stream the local service response. The local
  service computes the cursor diff and runs the audio/alignment processes.
- Queue polling entered the full framework API route, fetched completed jobs
  as well as active jobs, parsed that response, and then discarded history
  unless the queue modal requested it.
- Successful invocations sometimes exceeded 10 ms. Cloudflare documents
  occasional per-isolate flexibility, followed by enforcement when limits are
  hit consistently. These successes do not demonstrate a sustainable budget.

Cloudflare documents a 10 ms Free-plan HTTP CPU limit and excludes network
waiting from CPU time:
https://developers.cloudflare.com/workers/platform/limits/#cpu-time

The records identify failed requests, not per-function CPU samples. They do not
prove that a particular function consumed the budget or identify the deployed
version's exact Git commit. Local validation also does not establish production
CPU percentiles or guarantee all requests will stay below 10 ms.

## Changes

- Disable speculative navigation on shell menu, brand, and breadcrumb links.
- Keep studio authentication and page authorization on the server, but render
  the interactive shell and its page subtree in the browser using an explicit
  `ssr: false` boundary. This removes their initial HTML rendering; RSC routing
  and server components still execute on the Worker.
- Serve authenticated GET `/api/generation-queue` directly in the Worker before
  entering the framework request pipeline. Check the JWT and the user's active
  flag and authorization version on every request. Responses remain uncached.
- Request `history=0` from the local queue service for sidebar polls. The local
  service omits settled entries while preserving grouped audio progress and
  the complete batch summary. Omitted history parameters keep the old behavior.
  Opening the modal still requests history. Older local-service versions remain
  compatible; they simply return the larger payload until restarted.

## Validation and rollout

- Dashboard: all 264 tests pass; TypeScript and production-mode build pass.
- Local generation queue: all eight tests pass; TypeScript passes.
- Built Worker tested with isolated temporary D1 storage in local workerd and
  headless Chrome: current-projects → short-videos → current-projects works,
  with no JavaScript errors and no speculative navigation requests. Initial
  HTML omits the sidebar; the browser renders the complete page.
- Unauthenticated queue requests return 401 and protected page requests redirect
  to login. Unit tests cover invalid, revoked, unknown, and disabled sessions,
  history loading, older upstream responses, and service failures.

Deploy the rebuilt dashboard and restart the local video-project service to
activate both parts. No deployment was performed during this investigation.
After rollout, compare CPU distributions and exceededCpu outcomes for queue
polls, actual RSC navigation, and document loads separately. If remaining
framework/RSC work still exceeds the effective budget, further removal of
server rendering/routing or a larger CPU allowance will be necessary.
