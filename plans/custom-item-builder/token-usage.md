# Token usage: custom-item-builder

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 98 | 23,695 | 3,030,993 | 179,164 | 3,233,950 | $1.33 |
| /build-feature | 1 | 0 | 0 | 0 | 0 | 0 | $0.000 |
| **All workflows** | 2 | 98 | 23,695 | 3,030,993 | 179,164 | 3,233,950 | $1.33 |

## Run 1: /new-feature — 2026-10-05 02:15Z

Window: 2026-10-05T01:16:33.000Z → 2026-10-05T02:15:17.565Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 98 | 23,695 | 3,030,993 | 179,164 | 3,233,950 | $1.33 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 46 | 10,909 | 2,564,209 | 27,062 | 2,602,226 | $0.730 |
| feature-planner | 2 | 18 | 7,229 | 180,314 | 66,952 | 254,513 | $0.276 |
| rule-agent | 1 | 20 | 3,566 | 133,257 | 49,506 | 186,349 | $0.186 |
| feature-plan-reviewer | 1 | 14 | 1,991 | 153,213 | 35,644 | 190,862 | $0.140 |
| **Workflow total** |  | 98 | 23,695 | 3,030,993 | 179,164 | 3,233,950 | $1.33 |

## Run 2: /build-feature — 2026-10-05 02:22Z

Window: 2026-10-05T02:17:07.000Z → 2026-10-05T02:22:02.690Z. Main-session model(s): n/a.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Workflow total** |  | 0 | 0 | 0 | 0 | 0 | $0.000 |

