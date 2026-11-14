# Token usage: v1.33.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 14 | 2,701 | 990,914 | 5,197 | 998,826 | $0.246 |
| **All workflows** | 1 | 14 | 2,701 | 990,914 | 5,197 | 998,826 | $0.246 |

## Run 1: /release-feature — 2026-11-14 10:49Z

Window: 2026-11-14T10:44:44.000Z → 2026-11-14T10:49:14.096Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 14 | 2,701 | 990,914 | 5,197 | 998,826 | $0.246 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 14 | 2,701 | 990,914 | 5,197 | 998,826 | $0.246 |
| **Workflow total** |  | 14 | 2,701 | 990,914 | 5,197 | 998,826 | $0.246 |

