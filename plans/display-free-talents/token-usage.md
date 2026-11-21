# Token usage: display-free-talents

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 146 | 54,147 | 4,369,487 | 251,160 | 4,674,940 | $2.12 |
| /build-feature | 1 | 120 | 45,097 | 3,278,874 | 260,808 | 3,584,899 | $2.09 |
| **All workflows** | 2 | 266 | 99,244 | 7,648,361 | 511,968 | 8,259,839 | $4.21 |

## Run 1: /new-feature — 2026-11-21 03:52Z

Window: 2026-11-21T03:42:20.000Z → 2026-11-21T03:52:08.464Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 146 | 54,147 | 4,369,487 | 251,160 | 4,674,940 | $2.12 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 48 | 13,680 | 3,197,142 | 49,171 | 3,260,041 | $0.973 |
| rule-agent | 3 | 56 | 15,363 | 616,262 | 77,711 | 709,392 | $0.471 |
| feature-planner | 2 | 24 | 18,106 | 316,326 | 82,390 | 416,846 | $0.450 |
| feature-plan-reviewer | 1 | 18 | 6,998 | 239,757 | 41,888 | 288,661 | $0.223 |
| **Workflow total** |  | 146 | 54,147 | 4,369,487 | 251,160 | 4,674,940 | $2.12 |

## Run 2: /build-feature — 2026-11-21 04:28Z

Window: 2026-11-21T04:21:31.000Z → 2026-11-21T04:28:22.070Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 90 | 35,845 | 2,782,513 | 213,301 | 3,031,749 | $1.57 |
| claude-opus-5-5 | 30 | 9,252 | 496,361 | 47,507 | 553,150 | $0.522 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 32 | 6,677 | 1,867,234 | 80,363 | 1,954,306 | $0.762 |
| feature-designer | 1 | 10 | 6,737 | 96,434 | 44,606 | 147,787 | $0.198 |
| feature-tester | 1 | 30 | 17,397 | 585,148 | 56,348 | 658,923 | $0.432 |
| feature-dev | 1 | 18 | 5,034 | 233,697 | 31,984 | 270,733 | $0.177 |
| design-agent | 1 | 30 | 9,252 | 496,361 | 47,507 | 553,150 | $0.522 |
| **Workflow total** |  | 120 | 45,097 | 3,278,874 | 260,808 | 3,584,899 | $2.09 |

