# Token usage: talent-info-bubbles

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 166 | 53,294 | 5,962,682 | 237,410 | 6,253,552 | $2.40 |
| /build-feature | 1 | 126 | 46,280 | 3,346,800 | 261,260 | 3,654,466 | $1.90 |
| /release-feature | 1 | 16 | 3,696 | 1,167,632 | 8,964 | 1,180,308 | $0.306 |
| **All workflows** | 3 | 308 | 103,270 | 10,477,114 | 507,634 | 11,088,326 | $4.61 |

## Run 1: /new-feature — 2026-11-26 23:43Z

Window: 2026-11-26T23:16:28.000Z → 2026-11-26T23:43:48.908Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 166 | 53,294 | 5,962,682 | 237,410 | 6,253,552 | $2.40 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 54 | 12,010 | 2,949,317 | 54,760 | 3,016,141 | $0.929 |
| feature-plan-reviewer | 1 | 50 | 13,485 | 1,356,212 | 85,463 | 1,455,210 | $0.620 |
| feature-planner | 1 | 62 | 27,799 | 1,657,153 | 97,187 | 1,782,201 | $0.853 |
| **Workflow total** |  | 166 | 53,294 | 5,962,682 | 237,410 | 6,253,552 | $2.40 |

## Run 2: /build-feature — 2026-11-26 23:55Z

Window: 2026-11-26T23:49:48.000Z → 2026-11-26T23:55:57.860Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 126 | 46,280 | 3,346,800 | 261,260 | 3,654,466 | $1.90 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 34 | 7,763 | 1,842,788 | 76,449 | 1,927,034 | $0.752 |
| feature-designer | 1 | 18 | 9,517 | 295,502 | 55,344 | 360,381 | $0.293 |
| feature-dev | 1 | 30 | 10,503 | 556,593 | 51,225 | 618,351 | $0.344 |
| design-agent | 1 | 12 | 3,531 | 102,718 | 34,004 | 140,265 | $0.141 |
| feature-tester | 1 | 32 | 14,966 | 549,199 | 44,238 | 608,435 | $0.370 |
| **Workflow total** |  | 126 | 46,280 | 3,346,800 | 261,260 | 3,654,466 | $1.90 |

## Run 3: /release-feature — 2026-11-27 00:06Z

Window: 2026-11-27T00:04:19.000Z → 2026-11-27T00:06:26.450Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 3,696 | 1,167,632 | 8,964 | 1,180,308 | $0.306 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 3,696 | 1,167,632 | 8,964 | 1,180,308 | $0.306 |
| **Workflow total** |  | 16 | 3,696 | 1,167,632 | 8,964 | 1,180,308 | $0.306 |

