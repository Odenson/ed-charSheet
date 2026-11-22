# Token usage: v2.3.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 30 | 5,448 | 2,270,283 | 12,521 | 2,288,282 | $0.559 |
| **All workflows** | 1 | 30 | 5,448 | 2,270,283 | 12,521 | 2,288,282 | $0.559 |

## Run 1: /release-feature — 2026-11-22 12:46Z

Window: 2026-11-22T12:42:58.000Z → 2026-11-22T12:46:36.634Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 30 | 5,448 | 2,270,283 | 12,521 | 2,288,282 | $0.559 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 30 | 5,448 | 2,270,283 | 12,521 | 2,288,282 | $0.559 |
| **Workflow total** |  | 30 | 5,448 | 2,270,283 | 12,521 | 2,288,282 | $0.559 |

