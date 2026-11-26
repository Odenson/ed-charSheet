# Token usage: v2.12.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 16 | 3,316 | 1,162,531 | 173,400 | 1,339,263 | $0.959 |
| **All workflows** | 1 | 16 | 3,316 | 1,162,531 | 173,400 | 1,339,263 | $0.959 |

## Run 1: /release-feature — 2026-11-26 12:31Z

Window: 2026-11-26T01:08:46.000Z → 2026-11-26T12:31:36.801Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 3,316 | 1,162,531 | 173,400 | 1,339,263 | $0.959 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 3,316 | 1,162,531 | 173,400 | 1,339,263 | $0.959 |
| **Workflow total** |  | 16 | 3,316 | 1,162,531 | 173,400 | 1,339,263 | $0.959 |

