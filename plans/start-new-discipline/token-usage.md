# Token usage: start-new-discipline

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 122 | 56,795 | 4,317,153 | 256,312 | 4,630,382 | $2.18 |
| **All workflows** | 1 | 122 | 56,795 | 4,317,153 | 256,312 | 4,630,382 | $2.18 |

## Run 1: /new-feature — 2026-11-21 06:08Z

Window: 2026-11-21T05:59:00.000Z → 2026-11-21T06:08:14.409Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 122 | 56,795 | 4,317,153 | 256,312 | 4,630,382 | $2.18 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 56 | 18,224 | 3,471,087 | 69,085 | 3,558,452 | $1.15 |
| rule-agent | 1 | 16 | 6,866 | 167,392 | 35,939 | 210,213 | $0.192 |
| feature-planner | 3 | 36 | 25,015 | 503,968 | 109,302 | 638,321 | $0.624 |
| feature-plan-reviewer | 1 | 14 | 6,690 | 174,706 | 41,986 | 223,396 | $0.207 |
| **Workflow total** |  | 122 | 56,795 | 4,317,153 | 256,312 | 4,630,382 | $2.18 |

