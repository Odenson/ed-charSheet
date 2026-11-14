# Token usage: embedded-die-roll

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 74 | 19,110 | 4,036,800 | 90,813 | 4,146,797 | $1.24 |
| /build-feature | 1 | 102 | 46,979 | 2,724,861 | 189,658 | 2,961,600 | $1.68 |
| **All workflows** | 2 | 176 | 66,089 | 6,761,661 | 280,471 | 7,108,397 | $2.93 |

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

## Run 2: /build-feature — 2026-11-14 09:57Z

Window: 2026-11-14T09:39:49.000Z → 2026-11-14T09:57:09.664Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 88 | 42,124 | 2,591,135 | 157,848 | 2,791,195 | $1.40 |
| claude-opus-5-5 | 14 | 4,855 | 133,726 | 31,810 | 170,405 | $0.283 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 40 | 8,712 | 1,964,522 | 44,292 | 2,017,566 | $0.657 |
| feature-tester | 1 | 16 | 20,840 | 212,093 | 47,828 | 280,777 | $0.370 |
| feature-designer | 1 | 8 | 4,857 | 56,286 | 26,094 | 87,245 | $0.125 |
| design-agent | 1 | 14 | 4,855 | 133,726 | 31,810 | 170,405 | $0.283 |
| feature-dev | 1 | 24 | 7,715 | 358,234 | 39,634 | 405,607 | $0.248 |
| **Workflow total** |  | 102 | 46,979 | 2,724,861 | 189,658 | 2,961,600 | $1.68 |

