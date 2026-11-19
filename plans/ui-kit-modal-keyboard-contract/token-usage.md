# Token usage: ui-kit-modal-keyboard-contract

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 464 | 300,696 | 42,867,649 | 2,319,540 | 45,488,349 | $27.78 |
| **All workflows** | 1 | 464 | 300,696 | 42,867,649 | 2,319,540 | 45,488,349 | $27.78 |

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

