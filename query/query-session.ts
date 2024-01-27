import {Session} from "../table";
import {Endpoint} from "../discovery";
import {Logger} from "../logging";
import * as grpc from "@grpc/grpc-js";
import {Ydb} from "ydb-sdk-proto";
import QueryService = Ydb.Query.V1.QueryService;

export class QuerySession extends Session<any> {

    constructor(
        api: QueryService,
        endpoint: Endpoint,
        sessionId: string,
        logger: Logger,
        getResponseMetadata: (request: object) => grpc.Metadata | undefined
    ) {
        super(api, endpoint, sessionId, logger, getResponseMetadata);
    }

    // TODO: Add methods
}
