# Token usage: update-notes-edit

Estimated from list prices in `tools/token-pricing.json` (as of 2026-09-25); a subscription plan bills differently. Output is the larger of the recorded count and a size estimate of the text and tool calls written (transcripts under-record it), so treat it as a lower bound; hidden thinking is not visible. Cache read/write are prompt-cache tokens, billed at their own rates.

## Total per workflow

| Workflow | Runs | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /new-feature | 1 | 128 | 47,282 | 4,763,342 | 193,623 | 5,004,375 | $1.99 |
| /build-feature | 1 | 136 | 51,590 | 3,967,736 | 224,721 | 4,244,183 | $1.94 |
| /release-feature | 1 | 24 | 4,615 | 1,717,204 | 9,915 | 1,731,758 | $0.429 |
| **All workflows** | 3 | 288 | 103,487 | 10,448,282 | 428,259 | 10,980,316 | $4.35 |

## Run 1: /new-feature — 2026-11-26 21:12Z

Window: 2026-11-26T21:01:40.000Z → 2026-11-26T21:12:10.269Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 128 | 47,282 | 4,763,342 | 193,623 | 5,004,375 | $1.99 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 56 | 11,692 | 3,085,567 | 50,934 | 3,148,249 | $0.938 |
| feature-planner | 1 | 48 | 27,854 | 1,252,400 | 86,914 | 1,367,216 | $0.746 |
| feature-plan-reviewer | 1 | 24 | 7,736 | 425,375 | 55,775 | 488,910 | $0.302 |
| **Workflow total** |  | 128 | 47,282 | 4,763,342 | 193,623 | 5,004,375 | $1.99 |

## Run 2: /build-feature — 2026-11-26 21:20Z

Window: 2026-11-26T21:13:29.000Z → 2026-11-26T21:20:26.515Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 136 | 51,590 | 3,967,736 | 224,721 | 4,244,183 | $1.94 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 40 | 8,336 | 2,217,392 | 42,656 | 2,268,424 | $0.698 |
| design-agent | 1 | 14 | 5,192 | 130,934 | 32,183 | 168,323 | $0.159 |
| feature-dev | 1 | 40 | 15,392 | 1,049,619 | 69,466 | 1,134,517 | $0.538 |
| feature-tester | 1 | 24 | 12,729 | 311,336 | 35,178 | 359,267 | $0.278 |
| feature-designer | 1 | 18 | 9,941 | 258,455 | 45,238 | 313,652 | $0.264 |
| **Workflow total** |  | 136 | 51,590 | 3,967,736 | 224,721 | 4,244,183 | $1.94 |

## Run 3: /release-feature — 2026-11-26 21:28Z

Window: 2026-11-26T21:25:39.000Z → 2026-11-26T21:28:49.399Z. Main-session model(s): claude-sonnet-5-5.

### By model (mode)

| Model | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-5-5 | 24 | 4,615 | 1,717,204 | 9,915 | 1,731,758 | $0.429 |

### By participant

| Participant | Spawns | Input | Output | Cache read | Cache write | Total tokens | Est. cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orchestrator | 1 | 24 | 4,615 | 1,717,204 | 9,915 | 1,731,758 | $0.429 |
| **Workflow total** |  | 24 | 4,615 | 1,717,204 | 9,915 | 1,731,758 | $0.429 |

