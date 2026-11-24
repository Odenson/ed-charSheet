# Token usage: simple-animate-portrait

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 60 | 20,475 | 2,304,631 | 97,201 | 2,422,367 | $0.953 |
| **All workflows** | 1 | 60 | 20,475 | 2,304,631 | 97,201 | 2,422,367 | $0.953 |

## Run 1: /new-feature — 2026-11-24 11:31Z

Window: 2026-11-24T11:25:47.000Z → 2026-11-24T11:31:05.174Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 60 | 20,475 | 2,304,631 | 97,201 | 2,422,367 | $0.953 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 34 | 8,113 | 2,025,654 | 29,434 | 2,063,235 | $0.604 |
| feature-plan-reviewer | 1 | 6 | 2,050 | 30,312 | 23,019 | 55,387 | $0.084 |
| feature-planner | 1 | 20 | 10,312 | 248,665 | 44,748 | 303,745 | $0.265 |
| **Workflow total** |  | 60 | 20,475 | 2,304,631 | 97,201 | 2,422,367 | $0.953 |

