# Token usage: skill-model

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 94 | 30,855 | 2,791,977 | 166,346 | 2,989,272 | $1.35 |
| **All workflows** | 1 | 94 | 30,855 | 2,791,977 | 166,346 | 2,989,272 | $1.35 |

## Run 1: /new-feature — 2026-11-22 12:50Z

Window: 2026-11-22T12:33:09.000Z → 2026-11-22T12:50:47.188Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 94 | 30,855 | 2,791,977 | 166,346 | 2,989,272 | $1.35 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 42 | 7,241 | 2,169,888 | 42,705 | 2,219,876 | $0.677 |
| feature-planner | 1 | 22 | 13,477 | 288,280 | 49,942 | 351,721 | $0.317 |
| feature-plan-reviewer | 1 | 12 | 4,104 | 100,142 | 28,657 | 132,915 | $0.133 |
| rule-agent | 1 | 18 | 6,033 | 233,667 | 45,042 | 284,760 | $0.220 |
| **Workflow total** |  | 94 | 30,855 | 2,791,977 | 166,346 | 2,989,272 | $1.35 |

