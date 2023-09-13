import * as grpc from '@grpc/grpc-js';
import * as $protobuf from 'protobufjs';
import { Ydb } from 'ydb-sdk-proto';
import Long from 'long';
import { StatusCode } from "./errors";
import { Endpoint } from './discovery';
import { IAuthService } from './credentials';
import { ISslCredentials } from './ssl-credentials';
export interface Pessimizable {
    endpoint: Endpoint;
}
declare type ServiceFactory<T> = {
    create(rpcImpl: $protobuf.RPCImpl, requestDelimited?: boolean, responseDelimited?: boolean): T;
};
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T>;
export declare class StreamEnd extends Error {
}
export declare abstract class GrpcService<Api extends $protobuf.rpc.Service> {
    private name;
    private apiCtor;
    protected api: Api;
    protected constructor(host: string, name: string, apiCtor: ServiceFactory<Api>, sslCredentials?: ISslCredentials);
    protected getClient(host: string, sslCredentials?: ISslCredentials): Api;
}
export declare type MetadataHeaders = Map<string, string>;
export declare type ClientOptions = Record<string, any>;
export declare abstract class AuthenticatedService<Api extends $protobuf.rpc.Service> {
    private name;
    private apiCtor;
    private authService;
    private sslCredentials?;
    protected api: Api;
    private metadata;
    private responseMetadata;
    private lastRequest;
    private readonly headers;
    static isServiceAsyncMethod(target: object, prop: string | number | symbol, receiver: any): boolean;
    getResponseMetadata(request: object): grpc.Metadata | undefined;
    protected constructor(host: string, database: string, name: string, apiCtor: ServiceFactory<Api>, authService: IAuthService, sslCredentials?: ISslCredentials | undefined, clientOptions?: ClientOptions);
    protected getClient(host: string, sslCredentials?: ISslCredentials, clientOptions?: ClientOptions): Api;
}
export interface AsyncResponse {
    operation?: Ydb.Operations.IOperation | null;
}
export declare function getOperationPayload(response: AsyncResponse): Uint8Array;
export declare function ensureOperationSucceeded(response: AsyncResponse, suppressedErrors?: StatusCode[]): void;
export declare function pessimizable(_target: Pessimizable, _propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor;
export declare function sleep(milliseconds: number): Promise<void>;
export declare function toLong(value: Long | number): Long;
export {};
