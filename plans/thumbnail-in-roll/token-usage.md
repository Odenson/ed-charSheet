# Token usage: thumbnail-in-roll

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 66 | 22,260 | 3,138,096 | 89,185 | 3,249,607 | $1.10 |
| /build-feature | 1 | 96 | 34,925 | 2,458,450 | 145,174 | 2,638,645 | $1.41 |
| **All workflows** | 2 | 162 | 57,185 | 5,596,546 | 234,359 | 5,888,252 | $2.50 |

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

## Run 2: /build-feature — 2026-11-14 10:26Z

Window: 2026-11-14T10:21:14.000Z → 2026-11-14T10:26:44.328Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 82 | 29,049 | 2,338,441 | 113,773 | 2,481,345 | $1.11 |
| claude-opus-5-5 | 14 | 5,876 | 120,009 | 31,401 | 157,300 | $0.299 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 40 | 8,132 | 1,956,804 | 43,741 | 2,008,717 | $0.648 |
| feature-dev | 1 | 20 | 6,438 | 200,463 | 25,033 | 231,954 | $0.167 |
| design-agent | 1 | 14 | 5,876 | 120,009 | 31,401 | 157,300 | $0.299 |
| feature-designer | 1 | 10 | 3,865 | 81,597 | 20,588 | 106,060 | $0.106 |
| feature-tester | 1 | 12 | 10,614 | 99,577 | 24,411 | 134,614 | $0.187 |
| **Workflow total** |  | 96 | 34,925 | 2,458,450 | 145,174 | 2,638,645 | $1.41 |

