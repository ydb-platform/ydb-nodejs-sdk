"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalTopicWrite = void 0;
var ydb_sdk_proto_1 = require("ydb-sdk-proto");
var StreamWriteMessage = ydb_sdk_proto_1.Ydb.Topic.StreamWriteMessage;
var InternalTopicWrite = /** @class */ (function () {
    function InternalTopicWrite(topicService, logger, opts) {
        this.topicService = topicService;
        this.logger = logger;
        this.opts = opts;
        topicService.updateMetadata();
        this.topicService.grpcClient
            .makeClientStreamRequest('/Ydb.Topic.V1.TopicService/StreamWrite', function (v) { return StreamWriteMessage.FromServer.encode(v).finish(); }, StreamWriteMessage.FromServer.decode, this.topicService.metadata, function (err, value) {
            // TODO: process
        });
    }
    return InternalTopicWrite;
}());
exports.InternalTopicWrite = InternalTopicWrite;
