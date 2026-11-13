# Token usage: homebrew-circle-adv

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 186 | 81,662 | 7,522,964 | 427,802 | 8,032,614 | $3.64 |
| **All workflows** | 1 | 186 | 81,662 | 7,522,964 | 427,802 | 8,032,614 | $3.64 |

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

