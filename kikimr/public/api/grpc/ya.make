PROTO_LIBRARY(api-grpc)
MAVEN_GROUP_ID(com.yandex.ydb)

GRPC()

OWNER(vvvv fomichev dcherednik g:kikimr)

SRCS(
    ydb_coordination_v1.proto
    ydb_discovery_v1.proto
    ydb_export_v1.proto
    ydb_import_v1.proto
    ydb_monitoring_v1.proto
    ydb_operation_v1.proto
    ydb_cms_v1.proto
    ydb_rate_limiter_v1.proto
    ydb_scheme_v1.proto
    ydb_scripting_v1.proto
    ydb_table_v1.proto
)

PEERDIR(
    kikimr/public/api/protos
)

EXCLUDE_TAGS(GO_PROTO)

END()
