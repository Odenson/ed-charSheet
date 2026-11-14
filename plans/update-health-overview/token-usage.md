# Token usage: update-health-overview

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 94 | 43,872 | 3,327,574 | 195,422 | 3,566,962 | $1.66 |
| **All workflows** | 1 | 94 | 43,872 | 3,327,574 | 195,422 | 3,566,962 | $1.66 |

## Run 1: /new-feature — 2026-11-14 23:21Z

Window: 2026-11-14T23:02:19.000Z → 2026-11-14T23:21:05.648Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 94 | 43,872 | 3,327,574 | 195,422 | 3,566,962 | $1.66 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 40 | 12,915 | 2,751,624 | 42,397 | 2,806,976 | $0.849 |
| feature-plan-reviewer | 1 | 12 | 6,031 | 136,781 | 40,046 | 182,870 | $0.188 |
| feature-planner | 2 | 20 | 18,527 | 227,035 | 80,347 | 325,929 | $0.432 |
| rule-agent | 1 | 22 | 6,399 | 212,134 | 32,632 | 251,187 | $0.188 |
| **Workflow total** |  | 94 | 43,872 | 3,327,574 | 195,422 | 3,566,962 | $1.66 |

