import type {
	CallOptions,
	Client,
	ClientDuplexStream,
	ClientReadableStream,
	ClientUnaryCall,
	ClientWritableStream,
	Metadata,
	ServiceDefinition,
	requestCallback,
} from '@grpc/grpc-js'

type UnaryMethod<Request, Response> = {
	(request: Request, callback: requestCallback<Response>): ClientUnaryCall
	(request: Request, metadata: Metadata, callback: requestCallback<Response>): ClientUnaryCall
	(request: Request, options: CallOptions, callback: requestCallback<Response>): ClientUnaryCall
	(
		request: Request,
		metadata: Metadata,
		options: CallOptions,
		callback: requestCallback<Response>
	): ClientUnaryCall
}

type ClientStreamingMethod<Request, Response> = {
	(callback: requestCallback<Response>): ClientWritableStream<Request>
	(metadata: Metadata, callback: requestCallback<Response>): ClientWritableStream<Request>
	(options: CallOptions, callback: requestCallback<Response>): ClientWritableStream<Request>
	(
		metadata: Metadata,
		options: CallOptions,
		callback: requestCallback<Response>
	): ClientWritableStream<Request>
}

export type ServiceClient<Service extends ServiceDefinition> = Client & {
	[Method in keyof Service as string extends Method
		? never
		: Method]: Service[Method]['requestStream'] extends true
		? Service[Method]['responseStream'] extends true
			? (
					metadataOrOptions?: Metadata | CallOptions,
					options?: CallOptions
				) => ClientDuplexStream<
					Parameters<Service[Method]['requestSerialize']>[0],
					ReturnType<Service[Method]['responseDeserialize']>
				>
			: ClientStreamingMethod<
					Parameters<Service[Method]['requestSerialize']>[0],
					ReturnType<Service[Method]['responseDeserialize']>
				>
		: Service[Method]['responseStream'] extends true
			? (
					request: Parameters<Service[Method]['requestSerialize']>[0],
					metadataOrOptions?: Metadata | CallOptions,
					options?: CallOptions
				) => ClientReadableStream<ReturnType<Service[Method]['responseDeserialize']>>
			: UnaryMethod<
					Parameters<Service[Method]['requestSerialize']>[0],
					ReturnType<Service[Method]['responseDeserialize']>
				>
}
