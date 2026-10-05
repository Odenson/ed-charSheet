# Token usage: spell-nights-edge

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /build-feature | 1 | 258 | 55,222 | 13,233,557 | 483,559 | 13,772,596 | $4.72 |
| /release-feature | 1 | 6 | 530 | 178,985 | 52,856 | 232,377 | $0.253 |
| **All workflows** | 2 | 264 | 55,752 | 13,412,542 | 536,415 | 14,004,973 | $4.97 |

## Run 1: /build-feature — 2026-10-04 05:04Z

Window: 2026-10-04T04:49:58.000Z → 2026-10-04T05:04:54.267Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 230 | 50,718 | 12,640,788 | 420,436 | 13,112,172 | $4.19 |
| claude-opus-5-5 | 28 | 4,504 | 592,769 | 63,123 | 660,424 | $0.524 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 48 | 11,267 | 5,089,907 | 71,316 | 5,172,538 | $1.42 |
| feature-dev | 2 | 114 | 19,942 | 5,257,229 | 186,322 | 5,463,607 | $1.72 |
| feature-designer | 1 | 12 | 4,246 | 104,654 | 44,764 | 153,676 | $0.175 |
| feature-tester | 1 | 56 | 15,263 | 2,188,998 | 118,034 | 2,322,351 | $0.886 |
| design-agent | 1 | 28 | 4,504 | 592,769 | 63,123 | 660,424 | $0.524 |
| **Workflow total** |  | 258 | 55,222 | 13,233,557 | 483,559 | 13,772,596 | $4.72 |

## Run 2: /release-feature — 2026-10-04 05:16Z

Window: 2026-10-04T05:14:10.000Z → 2026-10-04T05:16:26.450Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 6 | 530 | 178,985 | 52,856 | 232,377 | $0.253 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 6 | 530 | 178,985 | 52,856 | 232,377 | $0.253 |
| **Workflow total** |  | 6 | 530 | 178,985 | 52,856 | 232,377 | $0.253 |

