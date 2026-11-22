# Token usage: gen-skill-other

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 138 | 50,937 | 4,993,217 | 265,029 | 5,309,321 | $2.32 |
| /build-feature | 1 | 226 | 125,850 | 11,486,019 | 480,278 | 12,092,373 | $4.91 |
| **All workflows** | 2 | 364 | 176,787 | 16,479,236 | 745,307 | 17,401,694 | $7.24 |

## Run 1: /new-feature — 2026-11-22 21:39Z

Window: 2026-11-22T21:22:01.000Z → 2026-11-22T21:39:43.879Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 138 | 50,937 | 4,993,217 | 265,029 | 5,309,321 | $2.32 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 64 | 14,399 | 3,858,926 | 102,015 | 3,975,404 | $1.32 |
| rule-agent | 1 | 34 | 7,063 | 383,364 | 35,066 | 425,527 | $0.235 |
| feature-plan-reviewer | 1 | 12 | 5,680 | 140,641 | 39,772 | 186,105 | $0.184 |
| feature-planner | 1 | 28 | 23,795 | 610,286 | 88,176 | 722,285 | $0.581 |
| **Workflow total** |  | 138 | 50,937 | 4,993,217 | 265,029 | 5,309,321 | $2.32 |

## Run 2: /build-feature — 2026-11-22 21:56Z

Window: 2026-11-22T21:42:28.000Z → 2026-11-22T21:56:43.511Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 226 | 125,850 | 11,486,019 | 480,278 | 12,092,373 | $4.91 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 28 | 7,224 | 1,786,384 | 103,235 | 1,896,871 | $0.843 |
| feature-dev | 1 | 122 | 55,982 | 7,129,000 | 205,238 | 7,390,342 | $2.50 |
| design-agent | 1 | 10 | 3,539 | 69,045 | 21,967 | 94,561 | $0.104 |
| feature-designer | 1 | 6 | 7,841 | 43,273 | 26,006 | 77,126 | $0.152 |
| feature-tester | 1 | 60 | 51,264 | 2,458,317 | 123,832 | 2,633,473 | $1.31 |
| **Workflow total** |  | 226 | 125,850 | 11,486,019 | 480,278 | 12,092,373 | $4.91 |

