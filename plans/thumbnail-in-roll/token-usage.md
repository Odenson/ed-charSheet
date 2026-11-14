# Token usage: thumbnail-in-roll

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 66 | 22,260 | 3,138,096 | 89,185 | 3,249,607 | $1.10 |
| **All workflows** | 1 | 66 | 22,260 | 3,138,096 | 89,185 | 3,249,607 | $1.10 |

## Run 1: /new-feature — 2026-11-14 10:20Z

Window: 2026-11-14T10:13:52.000Z → 2026-11-14T10:20:08.774Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 66 | 22,260 | 3,138,096 | 89,185 | 3,249,607 | $1.10 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 38 | 7,425 | 2,925,922 | 14,650 | 2,948,035 | $0.718 |
| feature-planner | 2 | 18 | 11,298 | 137,748 | 48,691 | 197,755 | $0.262 |
| feature-plan-reviewer | 1 | 10 | 3,537 | 74,426 | 25,844 | 103,817 | $0.115 |
| **Workflow total** |  | 66 | 22,260 | 3,138,096 | 89,185 | 3,249,607 | $1.10 |

