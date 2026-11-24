# Token usage: v2.10.0

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /release-feature | 1 | 26 | 4,312 | 1,732,856 | 10,901 | 1,748,095 | $0.433 |
| **All workflows** | 1 | 26 | 4,312 | 1,732,856 | 10,901 | 1,748,095 | $0.433 |

## Run 1: /release-feature — 2026-11-24 11:46Z

Window: 2026-11-24T11:42:23.000Z → 2026-11-24T11:46:37.154Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 26 | 4,312 | 1,732,856 | 10,901 | 1,748,095 | $0.433 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 26 | 4,312 | 1,732,856 | 10,901 | 1,748,095 | $0.433 |
| **Workflow total** |  | 26 | 4,312 | 1,732,856 | 10,901 | 1,748,095 | $0.433 |

