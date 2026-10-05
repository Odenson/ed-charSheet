# Token usage: update-shadow-meld

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 108 | 27,810 | 2,570,696 | 185,937 | 2,784,551 | $1.34 |
| **All workflows** | 1 | 108 | 27,810 | 2,570,696 | 185,937 | 2,784,551 | $1.34 |

## Run 1: /new-feature — 2026-10-05 06:09Z

Window: 2026-10-05T05:55:49.000Z → 2026-10-05T06:09:54.779Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 108 | 27,810 | 2,570,696 | 185,937 | 2,784,551 | $1.34 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 50 | 10,528 | 2,092,483 | 55,013 | 2,158,074 | $0.744 |
| rule-agent | 1 | 16 | 4,820 | 135,040 | 28,949 | 168,825 | $0.148 |
| feature-planner | 3 | 26 | 9,821 | 188,528 | 65,948 | 264,323 | $0.301 |
| feature-plan-reviewer | 1 | 16 | 2,641 | 154,645 | 36,027 | 193,329 | $0.147 |
| **Workflow total** |  | 108 | 27,810 | 2,570,696 | 185,937 | 2,784,551 | $1.34 |

