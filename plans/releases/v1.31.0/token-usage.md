# Token usage: v1.31.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 22 | 6,769 | 5,217,353 | 9,767 | 5,233,911 | $1.15 |
| **All workflows** | 1 | 22 | 6,769 | 5,217,353 | 9,767 | 5,233,911 | $1.15 |

## Run 1: /release-feature — 2026-10-05 03:29Z

Window: 2026-10-05T03:27:19.000Z → 2026-10-05T03:29:57.493Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 22 | 6,769 | 5,217,353 | 9,767 | 5,233,911 | $1.15 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 22 | 6,769 | 5,217,353 | 9,767 | 5,233,911 | $1.15 |
| **Workflow total** |  | 22 | 6,769 | 5,217,353 | 9,767 | 5,233,911 | $1.15 |

