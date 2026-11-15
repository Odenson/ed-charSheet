# Token usage: v1.36.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 14 | 2,137 | 861,650 | 6,213 | 870,014 | $0.219 |
| **All workflows** | 1 | 14 | 2,137 | 861,650 | 6,213 | 870,014 | $0.219 |

## Run 1: /release-feature — 2026-11-15 00:40Z

Window: 2026-11-15T00:38:56.000Z → 2026-11-15T00:40:09.817Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 14 | 2,137 | 861,650 | 6,213 | 870,014 | $0.219 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 14 | 2,137 | 861,650 | 6,213 | 870,014 | $0.219 |
| **Workflow total** |  | 14 | 2,137 | 861,650 | 6,213 | 870,014 | $0.219 |

