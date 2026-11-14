# Token usage: discord-die-report

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 74 | 34,871 | 2,653,427 | 144,806 | 2,833,178 | $1.29 |
| /build-feature | 1 | 134 | 59,736 | 4,023,923 | 262,916 | 4,346,709 | $2.40 |
| **All workflows** | 2 | 208 | 94,607 | 6,677,350 | 407,722 | 7,179,887 | $3.69 |

## Run 1: /new-feature — 2026-11-14 09:04Z

Window: 2026-11-14T08:58:32.000Z → 2026-11-14T09:04:26.916Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 74 | 34,871 | 2,653,427 | 144,806 | 2,833,178 | $1.29 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 36 | 10,164 | 2,182,522 | 31,626 | 2,224,348 | $0.665 |
| feature-planner | 2 | 26 | 18,679 | 356,739 | 78,880 | 454,324 | $0.455 |
| feature-plan-reviewer | 1 | 12 | 6,028 | 114,166 | 34,300 | 154,506 | $0.169 |
| **Workflow total** |  | 74 | 34,871 | 2,653,427 | 144,806 | 2,833,178 | $1.29 |

## Run 2: /build-feature — 2026-11-14 09:21Z

Window: 2026-11-14T09:06:58.000Z → 2026-11-14T09:21:13.260Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 102 | 49,924 | 3,438,012 | 208,925 | 3,696,963 | $1.81 |
| claude-opus-5-5 | 32 | 9,812 | 585,911 | 53,991 | 649,746 | $0.584 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 44 | 13,810 | 2,440,854 | 69,498 | 2,524,206 | $0.904 |
| feature-designer | 1 | 14 | 7,070 | 158,467 | 35,110 | 200,661 | $0.190 |
| design-agent | 1 | 32 | 9,812 | 585,911 | 53,991 | 649,746 | $0.584 |
| feature-tester | 1 | 12 | 12,939 | 150,027 | 42,911 | 205,889 | $0.267 |
| feature-dev | 1 | 32 | 16,105 | 688,664 | 61,406 | 766,207 | $0.452 |
| **Workflow total** |  | 134 | 59,736 | 4,023,923 | 262,916 | 4,346,709 | $2.40 |

