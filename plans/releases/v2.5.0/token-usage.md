# Token usage: v2.5.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 32 | 6,910 | 5,227,847 | 10,126 | 5,244,915 | $1.16 |
| **All workflows** | 1 | 32 | 6,910 | 5,227,847 | 10,126 | 5,244,915 | $1.16 |

## Run 1: /release-feature — 2026-11-23 06:59Z

Window: 2026-11-23T06:39:18.000Z → 2026-11-23T06:59:19.784Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 32 | 6,910 | 5,227,847 | 10,126 | 5,244,915 | $1.16 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 32 | 6,910 | 5,227,847 | 10,126 | 5,244,915 | $1.16 |
| **Workflow total** |  | 32 | 6,910 | 5,227,847 | 10,126 | 5,244,915 | $1.16 |

