# Token usage: save-spinner

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 74 | 26,796 | 2,128,123 | 109,873 | 2,264,866 | $1.02 |
| /build-feature | 1 | 76 | 20,616 | 2,243,092 | 149,145 | 2,412,929 | $1.12 |
| **All workflows** | 2 | 150 | 47,412 | 4,371,215 | 259,018 | 4,677,795 | $2.14 |

## Run 1: /new-feature — 2026-11-23 09:32Z

Window: 2026-11-23T09:27:10.000Z → 2026-11-23T09:32:09.017Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 74 | 26,796 | 2,128,123 | 109,873 | 2,264,866 | $1.02 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 32 | 5,562 | 1,587,807 | 31,918 | 1,625,319 | $0.501 |
| feature-planner | 1 | 30 | 16,268 | 440,576 | 49,559 | 506,433 | $0.375 |
| feature-plan-reviewer | 1 | 12 | 4,966 | 99,740 | 28,396 | 133,114 | $0.141 |
| **Workflow total** |  | 74 | 26,796 | 2,128,123 | 109,873 | 2,264,866 | $1.02 |

## Run 2: /build-feature — 2026-11-23 09:36Z

Window: 2026-11-23T09:33:42.000Z → 2026-11-23T09:36:39.912Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 76 | 20,616 | 2,243,092 | 149,145 | 2,412,929 | $1.12 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 36 | 5,916 | 1,908,746 | 64,243 | 1,978,941 | $0.698 |
| feature-dev | 1 | 22 | 6,381 | 228,043 | 25,026 | 259,472 | $0.172 |
| design-agent | 1 | 6 | 2,488 | 32,276 | 23,894 | 58,664 | $0.091 |
| feature-tester | 1 | 6 | 1,739 | 32,969 | 13,099 | 47,813 | $0.057 |
| feature-designer | 1 | 6 | 4,092 | 41,058 | 22,883 | 68,039 | $0.106 |
| **Workflow total** |  | 76 | 20,616 | 2,243,092 | 149,145 | 2,412,929 | $1.12 |

