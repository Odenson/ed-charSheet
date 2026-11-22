# Token usage: create-new-adept

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 242 | 95,267 | 8,501,856 | 395,101 | 8,992,466 | $3.77 |
| /build-feature | 1 | 1,122 | 934,571 | 130,844,116 | 3,275,514 | 135,055,323 | $44.79 |
| /release-feature | 1 | 38 | 5,539 | 3,750,860 | 14,785 | 3,771,222 | $0.865 |
| **All workflows** | 3 | 1,402 | 1,035,377 | 143,096,832 | 3,685,400 | 147,819,011 | $49.42 |

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

## Run 2: /build-feature — 2026-11-21 23:23Z

Window: 2026-11-21T11:22:50.000Z → 2026-11-21T23:23:48.858Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 1,064 | 917,666 | 128,454,586 | 3,167,493 | 132,540,809 | $43.44 |
| claude-opus-5-5 | 58 | 16,905 | 2,389,530 | 108,021 | 2,514,514 | $1.36 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 126 | 46,701 | 9,222,038 | 432,210 | 9,701,075 | $4.04 |
| feature-dev | 3 | 472 | 336,846 | 60,286,136 | 1,117,680 | 61,741,134 | $18.22 |
| rule-agent | 1 | 98 | 79,242 | 5,263,643 | 181,539 | 5,524,522 | $2.30 |
| feature-tester | 1 | 224 | 321,998 | 36,511,615 | 999,745 | 37,833,582 | $13.02 |
| design-agent | 1 | 58 | 16,905 | 2,389,530 | 108,021 | 2,514,514 | $1.36 |
| feature-designer | 1 | 144 | 132,879 | 17,171,154 | 436,319 | 17,740,496 | $5.85 |
| **Workflow total** |  | 1,122 | 934,571 | 130,844,116 | 3,275,514 | 135,055,323 | $44.79 |

## Run 3: /release-feature — 2026-11-22 02:10Z

Window: 2026-11-22T02:06:54.000Z → 2026-11-22T02:10:17.464Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 38 | 5,539 | 3,750,860 | 14,785 | 3,771,222 | $0.865 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 38 | 5,539 | 3,750,860 | 14,785 | 3,771,222 | $0.865 |
| **Workflow total** |  | 38 | 5,539 | 3,750,860 | 14,785 | 3,771,222 | $0.865 |

