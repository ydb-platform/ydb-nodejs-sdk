// // TODO: Ref count
//
// import {Client} from "@grpc/grpc-js";
// import {IAuthService} from "../credentials";
// import {Logger} from "../logging";
// import {ISslCredentials} from "../ssl-credentials";
// import {ClientOptions} from "../utils";
//
// class GrpcClientFactory {
//
//     constructor(database: string, logger: Logger, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions) {
//     }
//
//     // TODO: Consider to close clients af some period of time of inactivity
//     // TODO: We may close clients that are no longer in discovery list
//     private cache = new WeakMap<String, Client>();
//
//     aquire(): Client {
//
//     }
//
//     release(client: Client) {
//
//     }
// }
//
//
