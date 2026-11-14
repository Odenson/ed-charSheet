# Token usage: embedded-die-roll

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 74 | 19,110 | 4,036,800 | 90,813 | 4,146,797 | $1.24 |
| **All workflows** | 1 | 74 | 19,110 | 4,036,800 | 90,813 | 4,146,797 | $1.24 |

## Run 1: /new-feature — 2026-11-14 09:32Z

Window: 2026-11-14T09:25:50.000Z → 2026-11-14T09:32:15.354Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 74 | 19,110 | 4,036,800 | 90,813 | 4,146,797 | $1.24 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 50 | 6,369 | 3,862,945 | 12,704 | 3,882,068 | $0.887 |
| feature-planner | 2 | 16 | 10,142 | 122,850 | 53,537 | 186,545 | $0.260 |
| feature-plan-reviewer | 1 | 8 | 2,599 | 51,005 | 24,572 | 78,184 | $0.098 |
| **Workflow total** |  | 74 | 19,110 | 4,036,800 | 90,813 | 4,146,797 | $1.24 |

