# Token usage: homebrew-circle-adv

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 186 | 81,662 | 7,522,964 | 427,802 | 8,032,614 | $3.64 |
| /build-feature | 1 | 192 | 79,473 | 5,820,228 | 295,994 | 6,195,887 | $3.09 |
| **All workflows** | 2 | 378 | 161,135 | 13,343,192 | 723,796 | 14,228,501 | $6.72 |

## Run 1: /new-feature — 2026-11-13 22:02Z

Window: 2026-11-13T10:58:32.000Z → 2026-11-13T22:02:11.886Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 186 | 81,662 | 7,522,964 | 427,802 | 8,032,614 | $3.64 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 70 | 18,740 | 6,029,746 | 165,129 | 6,213,685 | $2.05 |
| feature-planner | 3 | 44 | 39,681 | 853,318 | 149,674 | 1,042,717 | $0.942 |
| rule-agent | 3 | 62 | 16,615 | 554,838 | 81,392 | 652,907 | $0.481 |
| feature-plan-reviewer | 1 | 10 | 6,626 | 85,062 | 31,607 | 123,305 | $0.162 |
| **Workflow total** |  | 186 | 81,662 | 7,522,964 | 427,802 | 8,032,614 | $3.64 |

## Run 2: /build-feature — 2026-11-13 22:15Z

Window: 2026-11-13T22:03:29.000Z → 2026-11-13T22:15:10.374Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 158 | 66,643 | 5,201,256 | 238,278 | 5,506,335 | $2.42 |
| claude-opus-5-5 | 34 | 12,830 | 618,972 | 57,716 | 689,552 | $0.669 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 66 | 14,438 | 3,807,189 | 76,231 | 3,897,924 | $1.21 |
| feature-dev | 2 | 50 | 14,667 | 852,496 | 61,041 | 928,254 | $0.470 |
| feature-designer | 1 | 14 | 6,536 | 121,656 | 28,810 | 157,016 | $0.162 |
| feature-tester | 2 | 28 | 31,002 | 419,915 | 72,196 | 523,141 | $0.575 |
| design-agent | 1 | 34 | 12,830 | 618,972 | 57,716 | 689,552 | $0.669 |
| **Workflow total** |  | 192 | 79,473 | 5,820,228 | 295,994 | 6,195,887 | $3.09 |

