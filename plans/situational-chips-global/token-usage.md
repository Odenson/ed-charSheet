# Token usage: situational-chips-global

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 136 | 37,560 | 3,855,297 | 240,525 | 4,133,518 | $1.87 |
| /build-feature | 1 | 234 | 42,601 | 9,580,593 | 385,240 | 10,008,668 | $3.65 |
| **All workflows** | 2 | 370 | 80,161 | 13,435,890 | 625,765 | 14,142,186 | $5.52 |

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

## Run 2: /build-feature — 2026-10-05 04:08Z

Window: 2026-10-05T03:54:39.000Z → 2026-10-05T04:08:39.715Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 188 | 36,025 | 8,404,804 | 307,987 | 8,749,004 | $2.90 |
| claude-opus-5-5 | 46 | 6,576 | 1,175,789 | 77,253 | 1,259,664 | $0.753 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 44 | 9,920 | 3,462,117 | 55,684 | 3,527,765 | $1.01 |
| feature-dev | 2 | 102 | 14,593 | 4,431,793 | 151,485 | 4,597,973 | $1.41 |
| feature-tester | 2 | 34 | 7,105 | 456,390 | 68,665 | 532,194 | $0.334 |
| design-agent | 1 | 46 | 6,576 | 1,175,789 | 77,253 | 1,259,664 | $0.753 |
| feature-designer | 1 | 8 | 4,407 | 54,504 | 32,153 | 91,072 | $0.135 |
| **Workflow total** |  | 234 | 42,601 | 9,580,593 | 385,240 | 10,008,668 | $3.65 |

