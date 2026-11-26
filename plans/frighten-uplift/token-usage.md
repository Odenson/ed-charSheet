# Token usage: frighten-uplift

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 100 | 38,294 | 3,108,727 | 158,237 | 3,305,358 | $1.47 |
| /build-feature | 1 | 100 | 37,088 | 2,533,130 | 208,523 | 2,778,841 | $1.51 |
| /release-feature | 1 | 12 | 2,266 | 806,227 | 4,359 | 812,864 | $0.201 |
| **All workflows** | 3 | 212 | 77,648 | 6,448,084 | 371,119 | 6,897,063 | $3.18 |

## Run 1: /new-feature — 2026-11-24 11:57Z

Window: 2026-11-24T11:47:02.000Z → 2026-11-24T11:57:38.273Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 100 | 38,294 | 3,108,727 | 158,237 | 3,305,358 | $1.47 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 46 | 12,091 | 2,465,008 | 48,218 | 2,525,363 | $0.807 |
| rule-agent | 1 | 16 | 5,190 | 163,350 | 21,011 | 189,567 | $0.137 |
| feature-plan-reviewer | 1 | 18 | 7,355 | 242,826 | 43,426 | 293,625 | $0.231 |
| feature-planner | 1 | 20 | 13,658 | 237,543 | 45,582 | 296,803 | $0.298 |
| **Workflow total** |  | 100 | 38,294 | 3,108,727 | 158,237 | 3,305,358 | $1.47 |

## Run 2: /build-feature — 2026-11-24 12:04Z

Window: 2026-11-24T11:58:52.000Z → 2026-11-24T12:04:11.417Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 100 | 37,088 | 2,533,130 | 208,523 | 2,778,841 | $1.51 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 32 | 7,574 | 1,716,694 | 73,908 | 1,798,208 | $0.715 |
| feature-tester | 1 | 24 | 12,609 | 303,975 | 37,648 | 354,256 | $0.281 |
| feature-dev | 1 | 24 | 6,541 | 319,301 | 32,178 | 358,044 | $0.210 |
| design-agent | 1 | 10 | 4,695 | 98,412 | 35,293 | 138,410 | $0.155 |
| feature-designer | 1 | 10 | 5,669 | 94,748 | 29,496 | 129,923 | $0.149 |
| **Workflow total** |  | 100 | 37,088 | 2,533,130 | 208,523 | 2,778,841 | $1.51 |

## Run 3: /release-feature — 2026-11-24 12:17Z

Window: 2026-11-24T12:15:30.000Z → 2026-11-24T12:17:56.804Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 12 | 2,266 | 806,227 | 4,359 | 812,864 | $0.201 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 12 | 2,266 | 806,227 | 4,359 | 812,864 | $0.201 |
| **Workflow total** |  | 12 | 2,266 | 806,227 | 4,359 | 812,864 | $0.201 |

