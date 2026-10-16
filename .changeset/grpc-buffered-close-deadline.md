---
'@ydbjs/grpc': patch
---

Preserve buffered responses when HTTP/2 closes after terminal trailers but before the readable stream ends. Report an expired RPC deadline when a peer cancellation arrives before the local deadline timer runs.
