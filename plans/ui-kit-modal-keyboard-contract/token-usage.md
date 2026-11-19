# Token usage: ui-kit-modal-keyboard-contract

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 464 | 300,696 | 42,867,649 | 2,319,540 | 45,488,349 | $27.78 |
| /build-feature | 1 | 326 | 326,719 | 27,107,037 | 1,354,349 | 28,788,431 | $16.57 |
| **All workflows** | 2 | 790 | 627,415 | 69,974,686 | 3,673,889 | 74,276,780 | $44.36 |

## Run 1: /new-feature — 2026-11-18 16:38Z

Window: 2026-11-18T11:50:42.000Z → 2026-11-18T16:38:54.002Z. Main-session model(s): claude-opus-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-opus-5-5 | 464 | 300,696 | 42,867,649 | 2,319,540 | 45,488,349 | $27.78 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 74 | 39,512 | 9,916,766 | 531,917 | 10,488,269 | $7.03 |
| feature-planner | 2 | 260 | 164,285 | 23,297,128 | 1,530,652 | 24,992,325 | $15.60 |
| feature-plan-reviewer | 1 | 130 | 96,899 | 9,653,755 | 256,971 | 10,007,755 | $5.15 |
| **Workflow total** |  | 464 | 300,696 | 42,867,649 | 2,319,540 | 45,488,349 | $27.78 |

## Run 2: /build-feature — 2026-11-19 23:20Z

Window: 2026-11-18T19:59:06.000Z → 2026-11-19T23:20:36.788Z. Main-session model(s): claude-opus-5-5, claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-opus-5-5 | 212 | 184,826 | 15,467,243 | 787,843 | 16,440,124 | $11.22 |
| claude-sonnet-5-5 | 114 | 141,893 | 11,639,794 | 566,506 | 12,348,307 | $5.35 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 46 | 14,779 | 2,845,458 | 289,577 | 3,149,860 | $2.62 |
| feature-designer | 1 | 90 | 129,616 | 7,510,848 | 316,677 | 7,957,231 | $5.68 |
| feature-dev | 1 | 146 | 123,753 | 15,785,670 | 616,598 | 16,526,167 | $7.05 |
| design-agent | 1 | 16 | 4,118 | 156,427 | 32,296 | 192,857 | $0.275 |
| feature-tester | 1 | 28 | 54,453 | 808,634 | 99,201 | 962,316 | $0.954 |
| **Workflow total** |  | 326 | 326,719 | 27,107,037 | 1,354,349 | 28,788,431 | $16.57 |

