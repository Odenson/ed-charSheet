# Token usage: talent-info-bubbles

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 166 | 53,294 | 5,962,682 | 237,410 | 6,253,552 | $2.40 |
| **All workflows** | 1 | 166 | 53,294 | 5,962,682 | 237,410 | 6,253,552 | $2.40 |

## Run 1: /new-feature — 2026-11-26 23:43Z

Window: 2026-11-26T23:16:28.000Z → 2026-11-26T23:43:48.908Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 166 | 53,294 | 5,962,682 | 237,410 | 6,253,552 | $2.40 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 54 | 12,010 | 2,949,317 | 54,760 | 3,016,141 | $0.929 |
| feature-plan-reviewer | 1 | 50 | 13,485 | 1,356,212 | 85,463 | 1,455,210 | $0.620 |
| feature-planner | 1 | 62 | 27,799 | 1,657,153 | 97,187 | 1,782,201 | $0.853 |
| **Workflow total** |  | 166 | 53,294 | 5,962,682 | 237,410 | 6,253,552 | $2.40 |

