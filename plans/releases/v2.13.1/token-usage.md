# Token usage: v2.13.1

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 22 | 5,137 | 1,676,224 | 8,040 | 1,689,423 | $0.419 |
| **All workflows** | 1 | 22 | 5,137 | 1,676,224 | 8,040 | 1,689,423 | $0.419 |

## Run 1: /release-feature — 2026-11-26 21:41Z

Window: 2026-11-26T21:38:19.000Z → 2026-11-26T21:41:09.343Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 22 | 5,137 | 1,676,224 | 8,040 | 1,689,423 | $0.419 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 22 | 5,137 | 1,676,224 | 8,040 | 1,689,423 | $0.419 |
| **Workflow total** |  | 22 | 5,137 | 1,676,224 | 8,040 | 1,689,423 | $0.419 |

