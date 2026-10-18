---
'@ydbjs/abortable': patch
---

Consume a supplied promise's late rejection when its caller signal is already aborted. The caller still receives its original cancellation reason, while work that was already started can finish without an unhandled rejection.
