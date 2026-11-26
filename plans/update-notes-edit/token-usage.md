# Token usage: update-notes-edit

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 128 | 47,282 | 4,763,342 | 193,623 | 5,004,375 | $1.99 |
| **All workflows** | 1 | 128 | 47,282 | 4,763,342 | 193,623 | 5,004,375 | $1.99 |

## Run 1: /new-feature — 2026-11-26 21:12Z

Window: 2026-11-26T21:01:40.000Z → 2026-11-26T21:12:10.269Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 128 | 47,282 | 4,763,342 | 193,623 | 5,004,375 | $1.99 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 56 | 11,692 | 3,085,567 | 50,934 | 3,148,249 | $0.938 |
| feature-planner | 1 | 48 | 27,854 | 1,252,400 | 86,914 | 1,367,216 | $0.746 |
| feature-plan-reviewer | 1 | 24 | 7,736 | 425,375 | 55,775 | 488,910 | $0.302 |
| **Workflow total** |  | 128 | 47,282 | 4,763,342 | 193,623 | 5,004,375 | $1.99 |

