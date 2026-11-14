# Token usage: v1.34.1

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 14 | 2,796 | 997,841 | 3,879 | 1,004,530 | $0.243 |
| **All workflows** | 1 | 14 | 2,796 | 997,841 | 3,879 | 1,004,530 | $0.243 |

## Run 1: /release-feature — 2026-11-14 11:18Z

Window: 2026-11-14T11:15:38.000Z → 2026-11-14T11:18:09.284Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 14 | 2,796 | 997,841 | 3,879 | 1,004,530 | $0.243 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 14 | 2,796 | 997,841 | 3,879 | 1,004,530 | $0.243 |
| **Workflow total** |  | 14 | 2,796 | 997,841 | 3,879 | 1,004,530 | $0.243 |

