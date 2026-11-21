# Token usage: create-new-adept

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 242 | 95,267 | 8,501,856 | 395,101 | 8,992,466 | $3.77 |
| **All workflows** | 1 | 242 | 95,267 | 8,501,856 | 395,101 | 8,992,466 | $3.77 |

## Run 1: /new-feature — 2026-11-21 10:32Z

Window: 2026-11-21T10:08:18.000Z → 2026-11-21T10:32:35.718Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 242 | 95,267 | 8,501,856 | 395,101 | 8,992,466 | $3.77 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 98 | 26,343 | 6,331,938 | 83,135 | 6,441,514 | $1.86 |
| rule-agent | 4 | 94 | 28,719 | 1,336,961 | 146,962 | 1,512,736 | $0.922 |
| feature-plan-reviewer | 1 | 14 | 7,069 | 190,910 | 42,909 | 240,902 | $0.216 |
| feature-planner | 2 | 36 | 33,136 | 642,047 | 122,095 | 797,314 | $0.765 |
| **Workflow total** |  | 242 | 95,267 | 8,501,856 | 395,101 | 8,992,466 | $3.77 |

