---
'@ydbjs/core': patch
---

Apply `ydb.sdk.token_timeout_ms` to each caller's wait for credentials before RPCs. Preserve the original RPC deadline and caller abort reason without cancelling a shared provider refresh. Already-fulfilled cached token promises do not allocate a token-wait timer.
