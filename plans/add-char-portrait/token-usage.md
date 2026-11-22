# Token usage: add-char-portrait

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 88 | 33,770 | 3,284,264 | 153,656 | 3,471,778 | $1.43 |
| /build-feature | 1 | 302 | 158,956 | 14,837,091 | 570,263 | 15,566,612 | $6.42 |
| **All workflows** | 2 | 390 | 192,726 | 18,121,355 | 723,919 | 19,038,390 | $7.86 |

## Run 1: /new-feature — 2026-11-22 02:21Z

Window: 2026-11-22T02:11:29.000Z → 2026-11-22T02:21:06.316Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 88 | 33,770 | 3,284,264 | 153,656 | 3,471,778 | $1.43 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 56 | 10,967 | 2,910,370 | 36,316 | 2,957,709 | $0.837 |
| feature-planner | 2 | 22 | 18,417 | 273,917 | 83,178 | 375,534 | $0.447 |
| feature-plan-reviewer | 1 | 10 | 4,386 | 99,977 | 34,162 | 138,535 | $0.149 |
| **Workflow total** |  | 88 | 33,770 | 3,284,264 | 153,656 | 3,471,778 | $1.43 |

## Run 2: /build-feature — 2026-11-22 03:00Z

Window: 2026-11-22T02:40:22.000Z → 2026-11-22T03:00:27.292Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 260 | 144,888 | 13,586,563 | 484,455 | 14,216,166 | $5.46 |
| claude-opus-5-5 | 42 | 14,068 | 1,250,528 | 85,808 | 1,350,446 | $0.961 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 46 | 10,848 | 2,776,492 | 56,517 | 2,843,903 | $0.890 |
| feature-dev | 1 | 128 | 67,633 | 7,996,240 | 192,755 | 8,256,756 | $2.76 |
| feature-tester | 1 | 50 | 47,788 | 1,785,699 | 112,429 | 1,945,966 | $1.12 |
| design-agent | 1 | 42 | 14,068 | 1,250,528 | 85,808 | 1,350,446 | $0.961 |
| general-purpose | 1 | 28 | 10,167 | 974,569 | 87,019 | 1,071,783 | $0.514 |
| feature-designer | 1 | 8 | 8,452 | 53,563 | 35,735 | 97,758 | $0.185 |
| **Workflow total** |  | 302 | 158,956 | 14,837,091 | 570,263 | 15,566,612 | $6.42 |

