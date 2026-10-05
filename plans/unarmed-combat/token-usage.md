# Token usage: unarmed-combat

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 170 | 45,146 | 5,298,041 | 350,261 | 5,693,618 | $2.52 |
| /build-feature | 1 | 92 | 18,478 | 2,567,148 | 179,689 | 2,765,407 | $1.38 |
| /release-feature | 1 | 20 | 3,773 | 1,709,363 | 4,813 | 1,717,969 | $0.399 |
| **All workflows** | 3 | 282 | 67,397 | 9,574,552 | 534,763 | 10,176,994 | $4.30 |

## Run 1: /new-feature — 2026-10-05 00:42Z

Window: 2026-10-05T00:16:20.000Z → 2026-10-05T00:42:44.462Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 170 | 45,146 | 5,298,041 | 350,261 | 5,693,618 | $2.52 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 82 | 18,121 | 4,264,657 | 88,066 | 4,370,926 | $1.39 |
| feature-planner | 3 | 30 | 9,547 | 259,966 | 93,874 | 363,417 | $0.382 |
| rule-agent | 2 | 48 | 14,860 | 698,278 | 135,359 | 848,545 | $0.627 |
| feature-plan-reviewer | 1 | 10 | 2,618 | 75,140 | 32,962 | 110,730 | $0.124 |
| **Workflow total** |  | 170 | 45,146 | 5,298,041 | 350,261 | 5,693,618 | $2.52 |

## Run 2: /build-feature — 2026-10-05 00:50Z

Window: 2026-10-05T00:45:51.000Z → 2026-10-05T00:50:37.107Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 54 | 14,568 | 1,723,492 | 113,780 | 1,851,894 | $0.808 |
| claude-opus-5-5 | 38 | 3,910 | 843,656 | 65,909 | 913,513 | $0.577 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 18 | 5,431 | 1,351,770 | 21,811 | 1,379,030 | $0.412 |
| feature-designer | 1 | 8 | 3,480 | 65,292 | 30,996 | 99,776 | $0.125 |
| feature-dev | 1 | 20 | 3,018 | 237,767 | 30,962 | 271,767 | $0.155 |
| design-agent | 1 | 38 | 3,910 | 843,656 | 65,909 | 913,513 | $0.577 |
| feature-tester | 1 | 8 | 2,639 | 68,663 | 30,011 | 101,321 | $0.115 |
| **Workflow total** |  | 92 | 18,478 | 2,567,148 | 179,689 | 2,765,407 | $1.38 |

## Run 3: /release-feature — 2026-10-05 01:03Z

Window: 2026-10-05T00:57:53.000Z → 2026-10-05T01:03:41.496Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 20 | 3,773 | 1,709,363 | 4,813 | 1,717,969 | $0.399 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 20 | 3,773 | 1,709,363 | 4,813 | 1,717,969 | $0.399 |
| **Workflow total** |  | 20 | 3,773 | 1,709,363 | 4,813 | 1,717,969 | $0.399 |

