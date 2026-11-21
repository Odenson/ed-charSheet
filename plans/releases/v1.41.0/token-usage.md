# Token usage: v1.41.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 16 | 2,376 | 1,184,182 | 4,067 | 1,190,641 | $0.277 |
| **All workflows** | 1 | 16 | 2,376 | 1,184,182 | 4,067 | 1,190,641 | $0.277 |

## Run 1: /release-feature — 2026-11-21 05:28Z

Window: 2026-11-21T05:26:02.000Z → 2026-11-21T05:28:32.916Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 2,376 | 1,184,182 | 4,067 | 1,190,641 | $0.277 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 2,376 | 1,184,182 | 4,067 | 1,190,641 | $0.277 |
| **Workflow total** |  | 16 | 2,376 | 1,184,182 | 4,067 | 1,190,641 | $0.277 |

