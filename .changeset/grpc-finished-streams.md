---
'@ydbjs/grpc': patch
---

Avoid sending HTTP/2 CANCEL resets after both stream directions have finished. Sustained unary calls, including calls with non-OK gRPC statuses, no longer trigger peer reset-rate protection.
