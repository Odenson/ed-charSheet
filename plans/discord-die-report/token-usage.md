# Token usage: discord-die-report

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 74 | 34,871 | 2,653,427 | 144,806 | 2,833,178 | $1.29 |
| **All workflows** | 1 | 74 | 34,871 | 2,653,427 | 144,806 | 2,833,178 | $1.29 |

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

