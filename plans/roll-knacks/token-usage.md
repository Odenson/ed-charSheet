# Token usage: roll-knacks

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 200 | 80,870 | 6,441,716 | 323,307 | 6,846,093 | $3.00 |
| /build-feature | 1 | 174 | 57,538 | 4,935,759 | 287,844 | 5,281,315 | $2.65 |
| /release-feature | 1 | 16 | 3,011 | 1,439,071 | 5,309 | 1,447,407 | $0.339 |
| **All workflows** | 3 | 390 | 141,419 | 12,816,546 | 616,460 | 13,574,815 | $6.00 |

## Run 1: /new-feature — 2026-11-15 11:41Z

Window: 2026-11-15T11:13:11.000Z → 2026-11-15T11:41:39.776Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 200 | 80,870 | 6,441,716 | 323,307 | 6,846,093 | $3.00 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 80 | 20,407 | 4,580,592 | 64,590 | 4,665,669 | $1.38 |
| feature-planner | 2 | 34 | 28,960 | 588,082 | 112,944 | 730,020 | $0.690 |
| rule-agent | 2 | 54 | 16,622 | 653,637 | 82,430 | 752,743 | $0.503 |
| feature-plan-reviewer | 1 | 32 | 14,881 | 619,405 | 63,343 | 697,661 | $0.431 |
| **Workflow total** |  | 200 | 80,870 | 6,441,716 | 323,307 | 6,846,093 | $3.00 |

## Run 2: /build-feature — 2026-11-15 11:52Z

Window: 2026-11-15T11:43:44.000Z → 2026-11-15T11:52:09.238Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 140 | 45,932 | 4,183,939 | 220,923 | 4,450,934 | $1.94 |
| claude-opus-5-5 | 34 | 11,606 | 751,820 | 66,921 | 830,381 | $0.717 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 40 | 8,271 | 2,166,002 | 58,491 | 2,232,804 | $0.750 |
| design-agent | 1 | 34 | 11,606 | 751,820 | 66,921 | 830,381 | $0.717 |
| feature-tester | 2 | 36 | 18,989 | 637,231 | 64,856 | 721,112 | $0.480 |
| feature-dev | 1 | 54 | 12,450 | 1,279,256 | 63,563 | 1,355,323 | $0.539 |
| feature-designer | 1 | 10 | 6,222 | 101,450 | 34,013 | 141,695 | $0.168 |
| **Workflow total** |  | 174 | 57,538 | 4,935,759 | 287,844 | 5,281,315 | $2.65 |

## Run 3: /release-feature — 2026-11-15 12:16Z

Window: 2026-11-15T12:14:52.000Z → 2026-11-15T12:16:25.691Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 3,011 | 1,439,071 | 5,309 | 1,447,407 | $0.339 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 3,011 | 1,439,071 | 5,309 | 1,447,407 | $0.339 |
| **Workflow total** |  | 16 | 3,011 | 1,439,071 | 5,309 | 1,447,407 | $0.339 |

