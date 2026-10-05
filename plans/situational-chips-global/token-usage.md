# Token usage: situational-chips-global

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 136 | 37,560 | 3,855,297 | 240,525 | 4,133,518 | $1.87 |
| **All workflows** | 1 | 136 | 37,560 | 3,855,297 | 240,525 | 4,133,518 | $1.87 |

## Run 1: /new-feature — 2026-10-05 03:40Z

Window: 2026-10-05T03:27:17.000Z → 2026-10-05T03:40:33.084Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 136 | 37,560 | 3,855,297 | 240,525 | 4,133,518 | $1.87 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 66 | 17,418 | 3,192,937 | 79,182 | 3,289,603 | $1.13 |
| feature-planner | 2 | 26 | 9,966 | 279,049 | 70,446 | 359,487 | $0.332 |
| rule-agent | 3 | 30 | 8,093 | 227,256 | 55,225 | 290,604 | $0.265 |
| feature-plan-reviewer | 1 | 14 | 2,083 | 156,055 | 35,672 | 193,824 | $0.141 |
| **Workflow total** |  | 136 | 37,560 | 3,855,297 | 240,525 | 4,133,518 | $1.87 |

