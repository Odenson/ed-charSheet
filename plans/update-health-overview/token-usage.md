# Token usage: update-health-overview

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 94 | 43,872 | 3,327,574 | 195,422 | 3,566,962 | $1.66 |
| /build-feature | 1 | 146 | 55,613 | 4,385,173 | 245,737 | 4,686,669 | $2.36 |
| /release-feature | 1 | 16 | 2,852 | 1,436,747 | 5,415 | 1,445,030 | $0.338 |
| **All workflows** | 3 | 256 | 102,337 | 9,149,494 | 446,574 | 9,698,661 | $4.35 |

## Run 1: /new-feature — 2026-11-14 23:21Z

Window: 2026-11-14T23:02:19.000Z → 2026-11-14T23:21:05.648Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 94 | 43,872 | 3,327,574 | 195,422 | 3,566,962 | $1.66 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 40 | 12,915 | 2,751,624 | 42,397 | 2,806,976 | $0.849 |
| feature-plan-reviewer | 1 | 12 | 6,031 | 136,781 | 40,046 | 182,870 | $0.188 |
| feature-planner | 2 | 20 | 18,527 | 227,035 | 80,347 | 325,929 | $0.432 |
| rule-agent | 1 | 22 | 6,399 | 212,134 | 32,632 | 251,187 | $0.188 |
| **Workflow total** |  | 94 | 43,872 | 3,327,574 | 195,422 | 3,566,962 | $1.66 |

## Run 2: /build-feature — 2026-11-14 23:33Z

Window: 2026-11-14T23:25:38.000Z → 2026-11-14T23:33:18.857Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 124 | 46,833 | 4,051,266 | 199,198 | 4,297,421 | $1.88 |
| claude-opus-5-5 | 22 | 8,780 | 333,907 | 46,539 | 389,248 | $0.475 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 48 | 9,935 | 2,776,170 | 69,015 | 2,855,168 | $0.931 |
| feature-tester | 1 | 16 | 10,097 | 162,555 | 31,559 | 204,227 | $0.212 |
| design-agent | 1 | 22 | 8,780 | 333,907 | 46,539 | 389,248 | $0.475 |
| feature-dev | 1 | 46 | 19,682 | 979,242 | 66,190 | 1,065,160 | $0.558 |
| feature-designer | 1 | 14 | 7,119 | 133,299 | 32,434 | 172,866 | $0.179 |
| **Workflow total** |  | 146 | 55,613 | 4,385,173 | 245,737 | 4,686,669 | $2.36 |

## Run 3: /release-feature — 2026-11-14 23:55Z

Window: 2026-11-14T23:54:13.000Z → 2026-11-14T23:55:54.429Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 2,852 | 1,436,747 | 5,415 | 1,445,030 | $0.338 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 2,852 | 1,436,747 | 5,415 | 1,445,030 | $0.338 |
| **Workflow total** |  | 16 | 2,852 | 1,436,747 | 5,415 | 1,445,030 | $0.338 |

