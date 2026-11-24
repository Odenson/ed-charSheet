# Token usage: active-condition-window

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 186 | 96,174 | 11,026,685 | 431,254 | 11,554,299 | $4.52 |
| /build-feature | 1 | 212 | 97,979 | 8,168,943 | 399,264 | 8,666,398 | $3.74 |
| /release-feature | 1 | 16 | 2,775 | 1,283,333 | 7,199 | 1,293,323 | $0.313 |
| **All workflows** | 3 | 414 | 196,928 | 20,478,961 | 837,717 | 21,514,020 | $8.57 |

## Run 1: /new-feature — 2026-11-24 10:45Z

Window: 2026-11-24T09:47:19.000Z → 2026-11-24T10:45:52.028Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 186 | 96,174 | 11,026,685 | 431,254 | 11,554,299 | $4.52 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 100 | 38,395 | 9,598,480 | 181,958 | 9,818,933 | $3.03 |
| feature-planner | 1 | 38 | 35,026 | 717,497 | 146,848 | 899,409 | $0.861 |
| rule-agent | 1 | 36 | 14,044 | 581,751 | 59,944 | 655,775 | $0.407 |
| feature-plan-reviewer | 1 | 12 | 8,709 | 128,957 | 42,504 | 180,182 | $0.219 |
| **Workflow total** |  | 186 | 96,174 | 11,026,685 | 431,254 | 11,554,299 | $4.52 |

## Run 2: /build-feature — 2026-11-24 11:02Z

Window: 2026-11-24T10:50:11.000Z → 2026-11-24T11:02:45.051Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 212 | 97,979 | 8,168,943 | 399,264 | 8,666,398 | $3.74 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 44 | 11,078 | 2,525,983 | 82,563 | 2,619,668 | $0.946 |
| feature-dev | 1 | 86 | 32,809 | 3,770,442 | 127,928 | 3,931,265 | $1.40 |
| feature-designer | 1 | 22 | 17,907 | 407,834 | 66,669 | 492,432 | $0.427 |
| design-agent | 1 | 10 | 3,401 | 113,699 | 42,747 | 159,857 | $0.164 |
| feature-tester | 1 | 50 | 32,784 | 1,350,985 | 79,357 | 1,463,176 | $0.797 |
| **Workflow total** |  | 212 | 97,979 | 8,168,943 | 399,264 | 8,666,398 | $3.74 |

## Run 3: /release-feature — 2026-11-24 11:17Z

Window: 2026-11-24T11:15:17.000Z → 2026-11-24T11:17:40.722Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 16 | 2,775 | 1,283,333 | 7,199 | 1,293,323 | $0.313 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 16 | 2,775 | 1,283,333 | 7,199 | 1,293,323 | $0.313 |
| **Workflow total** |  | 16 | 2,775 | 1,283,333 | 7,199 | 1,293,323 | $0.313 |

