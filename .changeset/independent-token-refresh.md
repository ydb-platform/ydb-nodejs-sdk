---
'@ydbjs/auth': patch
'@ydbjs/auth-yandex-cloud': patch
'@ydbjs/core': patch
---

Keep shared token refreshes independent of callers. Cancelling or timing out one token wait, or closing its Driver, no longer interrupts authentication needed by other callers. Static, metadata, and Yandex Cloud providers own a five-second foreground request budget; static and Yandex Cloud background refreshes have a thirty-second budget. Cached reads and callers joining a refresh do not create provider timeouts.

Driver bounds only its own wait, including the `token` getter, while retaining the original RPC deadline.
