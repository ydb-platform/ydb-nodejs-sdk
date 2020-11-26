PROTO_LIBRARY(api-protos)
MAVEN_GROUP_ID(com.yandex.ydb)

OWNER(vvvv fomichev dcherednik g:kikimr)

PEERDIR(
    kikimr/public/api/protos/validation
)

SRCS(
    draft/datastreams.proto
    draft/persqueue.proto
    draft/persqueue_error_codes.proto
    persqueue_error_codes_v1.proto
    ydb_persqueue_v1.proto
    ydb_persqueue_cluster_discovery.proto
    ydb_clickhouse_internal.proto
    ydb_cms.proto
    ydb_common.proto
    ydb_coordination.proto
    ydb_discovery.proto
    ydb_experimental.proto
    ydb_export.proto
    ydb_import.proto
    ydb_issue_message.proto
    ydb_monitoring.proto
    ydb_operation.proto
    ydb_query_stats.proto
    ydb_rate_limiter.proto
    ydb_scheme.proto
    ydb_scripting.proto
    ydb_status_codes.proto
    ydb_table.proto
    ydb_value.proto
    ydb_s3_internal.proto
    ydb_yql_internal.proto
)

SET_APPEND(CPP_PROTO_OPTS --plugin=protoc-gen-validation=\${tool:"kikimr/core/grpc_services/validation"} --validation_out=${ARCADIA_BUILD_ROOT}/${PROTO_NAMESPACE})

# .pb.h are only available in C++ variant of PROTO_LIBRARY
IF (MODULE_TAG STREQUAL "CPP_PROTO")
    GENERATE_ENUM_SERIALIZATION(draft/persqueue.pb.h)
    GENERATE_ENUM_SERIALIZATION(ydb_persqueue_cluster_discovery.pb.h)
ENDIF()

EXCLUDE_TAGS(GO_PROTO)

END()
