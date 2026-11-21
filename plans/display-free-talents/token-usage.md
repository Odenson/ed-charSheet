# Token usage: display-free-talents

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 146 | 54,147 | 4,369,487 | 251,160 | 4,674,940 | $2.12 |
| **All workflows** | 1 | 146 | 54,147 | 4,369,487 | 251,160 | 4,674,940 | $2.12 |

## Run 1: /new-feature — 2026-11-21 03:52Z

Window: 2026-11-21T03:42:20.000Z → 2026-11-21T03:52:08.464Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 146 | 54,147 | 4,369,487 | 251,160 | 4,674,940 | $2.12 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 48 | 13,680 | 3,197,142 | 49,171 | 3,260,041 | $0.973 |
| rule-agent | 3 | 56 | 15,363 | 616,262 | 77,711 | 709,392 | $0.471 |
| feature-planner | 2 | 24 | 18,106 | 316,326 | 82,390 | 416,846 | $0.450 |
| feature-plan-reviewer | 1 | 18 | 6,998 | 239,757 | 41,888 | 288,661 | $0.223 |
| **Workflow total** |  | 146 | 54,147 | 4,369,487 | 251,160 | 4,674,940 | $2.12 |

