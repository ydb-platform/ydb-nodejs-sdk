// import path from 'path';
// // import protobuf from 'protobufjs';
// import {google} from "../protos/typings";
// import Root = require("../protos/bundle");
//
//
// function getMessageName(type: string) : string {
//     const messageNameRe = /^type.googleapis.com\/(.+)$/;
//     const match = messageNameRe.exec(type);
//     if (match) {
//         return match[1];
//     } else {
//         return type;
//     }
// }
//
// // protobuf.load has kind of an issue with resolving imports relative to origin files - it does not
// // detect common path segments which lead to path duplication. Have to use protobuf.loadSync which is
// // free from that issue. Hence made the entire call synchronous.
// // function loadMessageTypesSync(basePath = path.resolve(__dirname, '../kikimr/public/api/protos')) {
// //     const paths = [];
// //     const filenames = fs.readdirSync(basePath);
// //
// //     for (const filename of filenames) {
// //         if (filename.endsWith('.proto')) {
// //             paths.push(path.join(basePath, filename));
// //         }
// //     }
// //
// //     return protobuf.loadSync(paths);
// // }
//
// // const _root = loadMessageTypesSync();
//
// // export function getType(qualifiedTypeName: string) {
// //     return Root.lookupType(qualifiedTypeName);
// // }
//
// // export function decodeMessage(message: google.protobuf.IAny) {
// //     const name = getMessageName(message.type_url as string);
// //     return getType(name).decode(message.value as Buffer);
// // }
//
// export const SERVICE_PROTO_DIR = path.resolve(__dirname, '../kikimr/public/api/grpc');
// export const LOADER_OPTS = {
//     keepCase: true,
//     longs: String,
//     enums: String,
//     defaults: true,
//     oneofs: true,
//     protobufjsVersion: 6,
//     includeDirs: [
//         path.resolve(__dirname, '..')
//     ]
// };
