import type { ServiceDefinition as GrpcServiceDefinition } from '@grpc/grpc-js'

import type { Metadata } from './metadata.js'

export type MethodDescriptor = {
	path: string
	requestStream: boolean
	responseStream: boolean
	options: { idempotencyLevel?: 'IDEMPOTENT' | 'NO_SIDE_EFFECTS' }
}

export type MethodDefinition<
	RequestIn,
	RequestOut,
	ResponseIn,
	ResponseOut,
	RequestStream extends boolean = boolean,
	ResponseStream extends boolean = boolean,
> = MethodDescriptor & {
	requestStream: RequestStream
	responseStream: ResponseStream
	/** Serialized request bytes belong to the RPC and will not be mutated or reused. */
	requestBufferOwned?: boolean
	requestSerialize(value: RequestIn): Uint8Array
	requestDeserialize(bytes: Uint8Array): RequestOut
	responseSerialize(value: ResponseIn): Uint8Array
	responseDeserialize(bytes: Uint8Array): ResponseOut
}

export type AnyMethodDefinition = MethodDefinition<any, any, any, any>
export type ServiceDefinition = Record<string, AnyMethodDefinition>

export type TsProtoMessageType<Message> = {
	encode(message: Message): { finish(): Uint8Array }
	decode(input: Uint8Array): Message
	fromPartial?(object: unknown): Message
}

export type TsProtoMethodDefinition<Request, Response> = {
	name: string
	requestType: TsProtoMessageType<Request>
	requestStream: boolean
	responseType: TsProtoMessageType<Response>
	responseStream: boolean
	options: MethodDescriptor['options'] & { _unknownFields?: {} }
}

export type TsProtoServiceDefinition = {
	name: string
	fullName: string
	methods: Record<string, TsProtoMethodDefinition<any, any>>
}

export type CompatServiceDefinition =
	| ServiceDefinition
	| GrpcServiceDefinition
	| TsProtoServiceDefinition

type TsProtoMessageIn<Type extends TsProtoMessageType<any>> = Type['fromPartial'] extends (
	...args: any[]
) => any
	? Parameters<Type['fromPartial']>[0]
	: Type extends TsProtoMessageType<infer Message>
		? Message
		: never

type FromTsProtoMethod<Method> =
	Method extends TsProtoMethodDefinition<infer Request, infer Response>
		? MethodDefinition<
				TsProtoMessageIn<Method['requestType']>,
				Request,
				TsProtoMessageIn<Method['responseType']>,
				Response,
				Method['requestStream'],
				Method['responseStream']
			>
		: never

type GrpcServiceMethodKeys<Service extends GrpcServiceDefinition> = keyof {
	[Key in keyof Service as string extends Key
		? never
		: number extends Key
			? never
			: Key]: Service[Key]
} &
	keyof Service

export type NormalizedServiceDefinition<Service extends CompatServiceDefinition> =
	Service extends ServiceDefinition
		? Service
		: Service extends GrpcServiceDefinition
			? {
					[Key in GrpcServiceMethodKeys<Service>]: MethodDefinition<
						Parameters<Service[Key]['requestSerialize']>[0],
						ReturnType<Service[Key]['requestDeserialize']>,
						Parameters<Service[Key]['responseSerialize']>[0],
						ReturnType<Service[Key]['responseDeserialize']>,
						Service[Key]['requestStream'],
						Service[Key]['responseStream']
					>
				}
			: Service extends TsProtoServiceDefinition
				? { [Key in keyof Service['methods']]: FromTsProtoMethod<Service['methods'][Key]> }
				: never

export type CallOptions = {
	metadata?: Metadata
	signal?: AbortSignal
	onHeader?(header: Metadata): void
	onTrailer?(trailer: Metadata): void
}

export type Client<Service extends CompatServiceDefinition, CallOptionsExt = {}> = RawClient<
	NormalizedServiceDefinition<Service>,
	CallOptionsExt
>

export type RawClient<Service extends ServiceDefinition, CallOptionsExt = {}> = {
	[Method in keyof Service]: ClientMethod<Service[Method], CallOptionsExt>
}

export type ClientMethod<
	Definition extends AnyMethodDefinition,
	CallOptionsExt = {},
> = Definition['requestStream'] extends false
	? ResponseMethod<Definition, Parameters<Definition['requestSerialize']>[0], CallOptionsExt>
	: Definition['requestStream'] extends true
		? ResponseMethod<
				Definition,
				AsyncIterable<Parameters<Definition['requestSerialize']>[0]>,
				CallOptionsExt
			>
		: never

type ResponseMethod<
	Definition extends AnyMethodDefinition,
	Request,
	CallOptionsExt,
> = Definition['responseStream'] extends false
	? (
			request: Request,
			options?: CallOptions & CallOptionsExt
		) => Promise<ReturnType<Definition['responseDeserialize']>>
	: Definition['responseStream'] extends true
		? (
				request: Request,
				options?: CallOptions & CallOptionsExt
			) => AsyncIterable<ReturnType<Definition['responseDeserialize']>>
		: never

export type DefaultCallOptions<Service extends ServiceDefinition, CallOptionsExt = {}> = {
	[Method in keyof Service | '*']?: CallOptions & Partial<CallOptionsExt>
}

export type ClientMiddlewareCall<Request, Response, NextCallOptionsExt = {}> = {
	method: MethodDescriptor
} & (
	| { requestStream: false; request: Request }
	| { requestStream: true; request: AsyncIterable<Request> }
) &
	(
		| {
				responseStream: false
				next(
					request: Request | AsyncIterable<Request>,
					options: CallOptions & Partial<NextCallOptionsExt>
				): AsyncGenerator<never, Response, undefined>
		  }
		| {
				responseStream: true
				next(
					request: Request | AsyncIterable<Request>,
					options: CallOptions & Partial<NextCallOptionsExt>
				): AsyncGenerator<Response, void, undefined>
		  }
	)

export type ClientMiddleware<CallOptionsExt = {}, RequiredCallOptionsExt = {}> = <
	Request,
	Response,
>(
	call: ClientMiddlewareCall<Request, Response, RequiredCallOptionsExt>,
	options: CallOptions & Partial<CallOptionsExt & RequiredCallOptionsExt>
) => AsyncGenerator<Response, Response | void, undefined>
