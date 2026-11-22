# Token usage: add-airSailor

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 158 | 62,961 | 5,538,910 | 276,893 | 5,878,922 | $2.51 |
| **All workflows** | 1 | 158 | 62,961 | 5,538,910 | 276,893 | 5,878,922 | $2.51 |

## Run 1: /new-feature — 2026-11-22 10:53Z

Window: 2026-11-22T10:43:30.000Z → 2026-11-22T10:53:14.021Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 158 | 62,961 | 5,538,910 | 276,893 | 5,878,922 | $2.51 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 62 | 20,981 | 3,383,337 | 56,692 | 3,461,072 | $1.11 |
| feature-plan-reviewer | 1 | 14 | 4,108 | 134,192 | 32,903 | 171,217 | $0.150 |
| rule-agent | 1 | 46 | 22,350 | 1,327,400 | 116,193 | 1,465,989 | $0.780 |
| feature-planner | 1 | 36 | 15,522 | 693,981 | 71,105 | 780,644 | $0.472 |
| **Workflow total** |  | 158 | 62,961 | 5,538,910 | 276,893 | 5,878,922 | $2.51 |

