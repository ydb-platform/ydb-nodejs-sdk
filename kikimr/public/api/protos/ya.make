PROTO_LIBRARY(api-protos)
MAVEN_GROUP_ID(com.yandex.ydb)

OWNER(vvvv fomichev dcherednik g:kikimr)

SRCS(
    draft/persqueue.proto
    draft/persqueue_error_codes.proto
    persqueue_error_codes_v1.proto
    ydb_persqueue_v1.proto
    ydb_persqueue_cluster_discovery.proto
    ydb_export.proto
    ydb_cms.proto
    ydb_common.proto
    ydb_coordination.proto
    ydb_discovery.proto
    ydb_experimental.proto
    ydb_issue_message.proto
    ydb_operation.proto
    ydb_query_stats.proto
    ydb_scheme.proto
    ydb_scripting.proto
    ydb_status_codes.proto
    ydb_table.proto
    ydb_value.proto
    ydb_s3_internal.proto
    ydb_yql_internal.proto
)


# Skip generation when just Python protobuf wrappers are created
IF (NOT PY_PROTOS_FOR)
    GENERATE_ENUM_SERIALIZATION(draft/persqueue.pb.h)
ENDIF()

END()
