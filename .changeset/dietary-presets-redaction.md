---
"@shared/observability": patch
---

Add `dietaryPresets` / `dietary_presets` to the log-redaction deny-list.

Cire stores dietary requirements as keys from a closed vocabulary as well as free
text. A key is no less revealing than the sentence it replaced — `halal` names a
religious practice outright, `nuts` a health condition — so it needs the same
scrubbing `dietary` already had. Structured is not anonymous.
