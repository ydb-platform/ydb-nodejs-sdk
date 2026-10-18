---
'@ydbjs/auth': patch
---

Create the static credentials provider's default timeout only when starting token acquisition. Cached token reads and calls sharing an existing refresh no longer allocate unused timeout signals.
