PROTO_LIBRARY(api-grpc-draft)
MAVEN_GROUP_ID(com.yandex.ydb)

GRPC()

OWNER(vvvv fomichev dcherednik g:kikimr)

SRCS(
    dummy.proto
    persqueue.proto
    ydb_clickhouse_internal_v1.proto
    ydb_datastreams_v1.proto
    ydb_persqueue_v1.proto
    ydb_experimental_v1.proto
    ydb_s3_internal_v1.proto
    ydb_yql_internal.proto
)

PEERDIR(
    kikimr/public/api/protos
)

EXCLUDE_TAGS(GO_PROTO)

END()
