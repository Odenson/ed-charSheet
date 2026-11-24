# Token usage: simple-animate-portrait

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 60 | 20,475 | 2,304,631 | 97,201 | 2,422,367 | $0.953 |
| /build-feature | 1 | 86 | 38,844 | 2,477,465 | 152,732 | 2,669,127 | $1.32 |
| **All workflows** | 2 | 146 | 59,319 | 4,782,096 | 249,933 | 5,091,494 | $2.27 |

## Run 1: /new-feature — 2026-11-24 11:31Z

Window: 2026-11-24T11:25:47.000Z → 2026-11-24T11:31:05.174Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 60 | 20,475 | 2,304,631 | 97,201 | 2,422,367 | $0.953 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 34 | 8,113 | 2,025,654 | 29,434 | 2,063,235 | $0.604 |
| feature-plan-reviewer | 1 | 6 | 2,050 | 30,312 | 23,019 | 55,387 | $0.084 |
| feature-planner | 1 | 20 | 10,312 | 248,665 | 44,748 | 303,745 | $0.265 |
| **Workflow total** |  | 60 | 20,475 | 2,304,631 | 97,201 | 2,422,367 | $0.953 |

## Run 2: /build-feature — 2026-11-24 11:37Z

Window: 2026-11-24T11:32:17.000Z → 2026-11-24T11:37:20.530Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 86 | 38,844 | 2,477,465 | 152,732 | 2,669,127 | $1.32 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 34 | 5,571 | 1,806,917 | 34,374 | 1,846,896 | $0.555 |
| feature-dev | 1 | 26 | 15,424 | 483,720 | 52,724 | 551,894 | $0.383 |
| feature-designer | 1 | 8 | 4,899 | 56,798 | 20,310 | 82,015 | $0.111 |
| feature-tester | 1 | 12 | 11,283 | 101,198 | 24,516 | 137,009 | $0.194 |
| design-agent | 1 | 6 | 1,667 | 28,832 | 20,808 | 51,313 | $0.074 |
| **Workflow total** |  | 86 | 38,844 | 2,477,465 | 152,732 | 2,669,127 | $1.32 |

