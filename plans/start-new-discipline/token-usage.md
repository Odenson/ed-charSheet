# Token usage: start-new-discipline

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 122 | 56,795 | 4,317,153 | 256,312 | 4,630,382 | $2.18 |
| /build-feature | 1 | 190 | 81,577 | 6,366,095 | 395,718 | 6,843,580 | $3.53 |
| **All workflows** | 2 | 312 | 138,372 | 10,683,248 | 652,030 | 11,473,962 | $5.70 |

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

## Run 2: /build-feature — 2026-11-21 06:21Z

Window: 2026-11-21T06:10:04.000Z → 2026-11-21T06:21:21.270Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 158 | 69,573 | 5,587,618 | 320,449 | 5,977,798 | $2.75 |
| claude-opus-5-5 | 32 | 12,004 | 778,477 | 75,269 | 865,782 | $0.772 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 42 | 9,096 | 2,531,512 | 93,490 | 2,634,140 | $0.971 |
| feature-tester | 2 | 42 | 27,391 | 963,626 | 89,256 | 1,080,315 | $0.690 |
| feature-dev | 1 | 60 | 24,933 | 1,913,063 | 96,394 | 2,034,450 | $0.873 |
| feature-designer | 1 | 14 | 8,153 | 179,417 | 41,309 | 228,893 | $0.221 |
| design-agent | 1 | 32 | 12,004 | 778,477 | 75,269 | 865,782 | $0.772 |
| **Workflow total** |  | 190 | 81,577 | 6,366,095 | 395,718 | 6,843,580 | $3.53 |

