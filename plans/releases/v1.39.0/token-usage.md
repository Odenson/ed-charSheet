# Token usage: v1.39.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 20 | 2,992 | 859,598 | 50,940 | 913,550 | $0.406 |
| **All workflows** | 1 | 20 | 2,992 | 859,598 | 50,940 | 913,550 | $0.406 |

## Run 1: /release-feature — 2026-11-20 09:19Z

Window: 2026-11-20T09:17:58.000Z → 2026-11-20T09:19:20.106Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 20 | 2,992 | 859,598 | 50,940 | 913,550 | $0.406 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 20 | 2,992 | 859,598 | 50,940 | 913,550 | $0.406 |
| **Workflow total** |  | 20 | 2,992 | 859,598 | 50,940 | 913,550 | $0.406 |

