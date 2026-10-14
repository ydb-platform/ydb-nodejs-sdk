import type {
	MethodDefinition as GrpcMethodDefinition,
	ServiceDefinition as GrpcServiceDefinition,
} from '@grpc/grpc-js'
import type {
	Client as PreviousClient,
	ClientMiddleware as PreviousClientMiddleware,
	Metadata as PreviousMetadata,
} from 'nice-grpc'
import { ClientError as PreviousClientError, Status as PreviousStatus } from 'nice-grpc'
import { expectTypeOf } from 'vitest'

import { ClientError, Status } from '../src/index.js'

import type {
	CallOptions,
	Client,
	ClientMiddleware,
	Metadata,
	TsProtoServiceDefinition,
} from '../src/index.js'

type Message = { value: number; nested: { label: string } }

interface GrpcMethods extends GrpcServiceDefinition {
	unary: GrpcMethodDefinition<Message, Message> & { requestStream: false; responseStream: false }
	server: GrpcMethodDefinition<Message, Message> & { requestStream: false; responseStream: true }
	client: GrpcMethodDefinition<Message, Message> & { requestStream: true; responseStream: false }
	bidi: GrpcMethodDefinition<Message, Message> & { requestStream: true; responseStream: true }
}

declare let client: Client<GrpcMethods>
declare let message: Message
declare let messages: AsyncIterable<Message>
expectTypeOf(client.unary(message)).toEqualTypeOf<Promise<Message>>()
expectTypeOf(client.server(message)).toEqualTypeOf<AsyncIterable<Message>>()
expectTypeOf(client.client(messages)).toEqualTypeOf<Promise<Message>>()
expectTypeOf(client.bidi(messages)).toEqualTypeOf<AsyncIterable<Message>>()
expectTypeOf<Client<GrpcMethods>>().toEqualTypeOf<PreviousClient<GrpcMethods>>()
// @ts-expect-error A grpc-js index signature must not expose arbitrary client methods.
client.typo(message)
// @ts-expect-error A unary request cannot be an async iterable.
client.unary(messages)
// @ts-expect-error A client-streaming request must be an async iterable.
client.client(message)

type DeepPartial<Type> = {
	[Key in keyof Type]?: Type[Key] extends object ? DeepPartial<Type[Key]> : Type[Key]
}
declare let codec: {
	encode(message: Message): { finish(): Uint8Array }
	decode(bytes: Uint8Array): Message
	fromPartial<Input extends DeepPartial<Message>>(input: Input): Message
}
let tsProto = {
	name: 'Service',
	fullName: 'test.Service',
	methods: {
		call: {
			name: 'Call',
			requestType: codec,
			responseType: codec,
			requestStream: false,
			responseStream: false,
			options: {},
		},
	},
} as const satisfies TsProtoServiceDefinition

declare let tsProtoClient: Client<typeof tsProto>
expectTypeOf(tsProtoClient.call({ nested: {} })).toEqualTypeOf<Promise<Message>>()
expectTypeOf<Client<typeof tsProto>>().toEqualTypeOf<PreviousClient<typeof tsProto>>()
// @ts-expect-error Nested partials must preserve scalar field types.
tsProtoClient.call({ nested: { label: 1 } })

expectTypeOf<Metadata>().toEqualTypeOf<PreviousMetadata>()
expectTypeOf<ClientMiddleware<{ extra: string }, { prior: number }>>().toEqualTypeOf<
	PreviousClientMiddleware<{ extra: string }, { prior: number }>
>()
expectTypeOf<CallOptions>().toEqualTypeOf<import('nice-grpc').CallOptions>()

let currentError = new ClientError('/test.Service/Call', PreviousStatus.UNAVAILABLE, 'offline')
let previousError = new PreviousClientError('/test.Service/Call', Status.UNAVAILABLE, 'offline')
expectTypeOf(currentError.code).toExtend<PreviousStatus>()
expectTypeOf(previousError.code).toExtend<Status>()
expectTypeOf<ClientError>().toExtend<PreviousClientError>()
expectTypeOf<PreviousClientError>().toExtend<ClientError>()
