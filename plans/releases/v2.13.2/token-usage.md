# Token usage: v2.13.2

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 18 | 3,569 | 1,359,654 | 8,369 | 1,371,610 | $0.341 |
| **All workflows** | 1 | 18 | 3,569 | 1,359,654 | 8,369 | 1,371,610 | $0.341 |

## Run 1: /release-feature — 2026-11-26 22:15Z

Window: 2026-11-26T22:08:38.000Z → 2026-11-26T22:15:00.650Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 18 | 3,569 | 1,359,654 | 8,369 | 1,371,610 | $0.341 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 18 | 3,569 | 1,359,654 | 8,369 | 1,371,610 | $0.341 |
| **Workflow total** |  | 18 | 3,569 | 1,359,654 | 8,369 | 1,371,610 | $0.341 |

