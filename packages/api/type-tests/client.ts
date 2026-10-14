import type {
	ClientDuplexStream,
	ClientReadableStream,
	ClientUnaryCall,
	ClientWritableStream,
	MethodDefinition,
	ServiceDefinition,
} from '@grpc/grpc-js'
import { expectTypeOf } from 'vitest'

import type { ServiceClient } from '../src/client.js'

type Request = { value: number }
type Response = { result: string }

interface Methods extends ServiceDefinition {
	unary: MethodDefinition<Request, Response> & { requestStream: false; responseStream: false }
	read: MethodDefinition<Request, Response> & { requestStream: false; responseStream: true }
	write: MethodDefinition<Request, Response> & { requestStream: true; responseStream: false }
	bidi: MethodDefinition<Request, Response> & { requestStream: true; responseStream: true }
}

declare let client: ServiceClient<Methods>
expectTypeOf(
	client.unary({ value: 1 }, (_error, response) => {
		expectTypeOf(response).toEqualTypeOf<Response | undefined>()
	})
).toEqualTypeOf<ClientUnaryCall>()
expectTypeOf(client.read({ value: 1 })).toEqualTypeOf<ClientReadableStream<Response>>()
expectTypeOf(client.write(() => {})).toEqualTypeOf<ClientWritableStream<Request>>()
expectTypeOf(client.bidi()).toEqualTypeOf<ClientDuplexStream<Request, Response>>()
client.bidi().write({ value: 1 })

// @ts-expect-error Service definitions must not permit arbitrary method names.
client.unknown({ value: 1 })
// @ts-expect-error Unary calls require a callback.
client.unary({ value: 1 })
// @ts-expect-error A native duplex stream validates request message types.
client.bidi().write({ value: 'invalid' })
