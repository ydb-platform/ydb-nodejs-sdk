---
'@ydbjs/core': patch
---

Apply `ydb.sdk.token_timeout_ms` to credential acquisition before RPCs, including providers that ignore cancellation. Preserve the original RPC deadline and caller abort reason. Stop token-wait timers and cancellation forwarding when credentials complete so background refresh remains independent. Already-fulfilled cached token promises do not allocate a token-wait timer.
