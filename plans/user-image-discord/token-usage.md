# Token usage: user-image-discord

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 60 | 14,732 | 1,658,246 | 86,014 | 1,759,052 | $0.724 |
| /build-feature | 1 | 78 | 27,496 | 1,845,082 | 126,657 | 1,999,313 | $1.12 |
| /release-feature | 1 | 16 | 2,392 | 927,186 | 4,686 | 934,280 | $0.228 |
| **All workflows** | 3 | 154 | 44,620 | 4,430,514 | 217,357 | 4,692,645 | $2.07 |

## Run 1: /new-feature — 2026-11-14 10:57Z

Window: 2026-11-14T10:51:15.000Z → 2026-11-14T10:57:43.135Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 60 | 14,732 | 1,658,246 | 86,014 | 1,759,052 | $0.724 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 32 | 5,199 | 1,455,970 | 19,618 | 1,480,819 | $0.422 |
| feature-planner | 2 | 18 | 7,066 | 138,365 | 43,345 | 188,794 | $0.207 |
| feature-plan-reviewer | 1 | 10 | 2,467 | 63,911 | 23,051 | 89,439 | $0.095 |
| **Workflow total** |  | 60 | 14,732 | 1,658,246 | 86,014 | 1,759,052 | $0.724 |

## Run 2: /build-feature — 2026-11-14 11:03Z

Window: 2026-11-14T10:59:04.000Z → 2026-11-14T11:03:07.969Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 66 | 23,255 | 1,753,575 | 99,528 | 1,876,424 | $0.882 |
| claude-opus-5-5 | 12 | 4,241 | 91,507 | 27,129 | 122,889 | $0.239 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 32 | 5,790 | 1,449,920 | 33,388 | 1,489,130 | $0.481 |
| feature-tester | 1 | 12 | 9,417 | 111,887 | 25,350 | 146,666 | $0.180 |
| feature-dev | 1 | 16 | 5,366 | 160,170 | 24,508 | 190,060 | $0.147 |
| design-agent | 1 | 12 | 4,241 | 91,507 | 27,129 | 122,889 | $0.239 |
| feature-designer | 1 | 6 | 2,682 | 31,598 | 16,282 | 50,568 | $0.074 |
| **Workflow total** |  | 78 | 27,496 | 1,845,082 | 126,657 | 1,999,313 | $1.12 |

## Run 3: /release-feature — 2026-11-14 11:10Z

Window: 2026-11-14T11:08:44.000Z → 2026-11-14T11:10:55.288Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 2,392 | 927,186 | 4,686 | 934,280 | $0.228 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 2,392 | 927,186 | 4,686 | 934,280 | $0.228 |
| **Workflow total** |  | 16 | 2,392 | 927,186 | 4,686 | 934,280 | $0.228 |

