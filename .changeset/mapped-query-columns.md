---
'@ydbjs/query': minor
---

Add the opt-in `mapColumnName` query option for mapping top-level result column
names to object keys without changing SQL. Mapping also applies to raw results
and transaction queries; positional `.values()` results are unchanged. Reject
duplicate mapped keys instead of silently overwriting column values.
