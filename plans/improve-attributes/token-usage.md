# Token usage: improve-attributes

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 112 | 42,144 | 3,206,193 | 189,704 | 3,438,153 | $1.61 |
| /build-feature | 1 | 98 | 44,700 | 3,012,326 | 182,058 | 3,239,182 | $1.55 |
| /release-feature | 1 | 16 | 2,768 | 1,421,244 | 7,140 | 1,431,168 | $0.341 |
| **All workflows** | 3 | 226 | 89,612 | 7,639,763 | 378,902 | 8,108,503 | $3.50 |

## Run 1: /new-feature — 2026-11-23 09:57Z

Window: 2026-11-23T09:44:50.000Z → 2026-11-23T09:57:19.897Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 112 | 42,144 | 3,206,193 | 189,704 | 3,438,153 | $1.61 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 40 | 10,932 | 2,091,857 | 46,447 | 2,149,276 | $0.714 |
| rule-agent | 1 | 28 | 9,944 | 409,366 | 49,221 | 468,559 | $0.304 |
| feature-plan-reviewer | 1 | 12 | 3,413 | 100,802 | 27,700 | 131,927 | $0.124 |
| feature-planner | 1 | 32 | 17,855 | 604,168 | 66,336 | 688,391 | $0.465 |
| **Workflow total** |  | 112 | 42,144 | 3,206,193 | 189,704 | 3,438,153 | $1.61 |

## Run 2: /build-feature — 2026-11-23 10:03Z

Window: 2026-11-23T09:58:03.000Z → 2026-11-23T10:03:27.579Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 98 | 44,700 | 3,012,326 | 182,058 | 3,239,182 | $1.55 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 26 | 5,104 | 1,855,582 | 30,703 | 1,891,415 | $0.545 |
| design-agent | 1 | 6 | 1,618 | 28,975 | 20,076 | 50,675 | $0.072 |
| feature-designer | 1 | 12 | 5,650 | 112,951 | 25,480 | 144,093 | $0.143 |
| feature-tester | 1 | 18 | 18,483 | 225,515 | 42,941 | 286,957 | $0.337 |
| feature-dev | 1 | 36 | 13,845 | 789,303 | 62,858 | 866,042 | $0.454 |
| **Workflow total** |  | 98 | 44,700 | 3,012,326 | 182,058 | 3,239,182 | $1.55 |

## Run 3: /release-feature — 2026-11-23 10:29Z

Window: 2026-11-23T10:24:23.000Z → 2026-11-23T10:29:13.955Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 2,768 | 1,421,244 | 7,140 | 1,431,168 | $0.341 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 2,768 | 1,421,244 | 7,140 | 1,431,168 | $0.341 |
| **Workflow total** |  | 16 | 2,768 | 1,421,244 | 7,140 | 1,431,168 | $0.341 |

