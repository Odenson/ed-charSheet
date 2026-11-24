# Token usage: v2.8.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 44 | 7,455 | 4,443,786 | 12,629 | 4,463,914 | $1.01 |
| **All workflows** | 1 | 44 | 7,455 | 4,443,786 | 12,629 | 4,463,914 | $1.01 |

## Run 1: /release-feature — 2026-11-23 11:26Z

Window: 2026-11-23T11:19:09.000Z → 2026-11-23T11:26:21.378Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 44 | 7,455 | 4,443,786 | 12,629 | 4,463,914 | $1.01 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 44 | 7,455 | 4,443,786 | 12,629 | 4,463,914 | $1.01 |
| **Workflow total** |  | 44 | 7,455 | 4,443,786 | 12,629 | 4,463,914 | $1.01 |

