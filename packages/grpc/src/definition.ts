import type {
	CompatServiceDefinition,
	ServiceDefinition,
	TsProtoServiceDefinition,
} from './types.js'

export function normalizeServiceDefinition(definition: CompatServiceDefinition): ServiceDefinition {
	if ('name' in definition && 'fullName' in definition && 'methods' in definition) {
		let service = definition as TsProtoServiceDefinition
		let methods: ServiceDefinition = {}

		for (let [key, method] of Object.entries(service.methods)) {
			let request = method.requestType
			let response = method.responseType

			methods[key] = {
				path: `/${service.fullName}/${method.name}`,
				requestStream: method.requestStream,
				responseStream: method.responseStream,
				requestSerialize: (value) =>
					request
						.encode(request.fromPartial ? request.fromPartial(value) : value)
						.finish(),
				requestDeserialize: request.decode,
				responseSerialize: (value) =>
					response
						.encode(response.fromPartial ? response.fromPartial(value) : value)
						.finish(),
				responseDeserialize: response.decode,
				options: method.options,
			}
		}

		return methods
	}

	let methods: ServiceDefinition = {}

	for (let [key, method] of Object.entries(definition)) {
		if (typeof method === 'object' && method !== null && typeof method.path === 'string') {
			methods[key] = {
				path: method.path,
				requestStream: method.requestStream,
				responseStream: method.responseStream,
				requestSerialize: (value) => method.requestSerialize(value),
				requestDeserialize: (bytes) => method.requestDeserialize(bytes),
				responseSerialize: (value) => method.responseSerialize(value),
				responseDeserialize: (bytes) => method.responseDeserialize(bytes),
				options: method.options ?? {},
				...(method.requestBufferOwned !== undefined && {
					requestBufferOwned: method.requestBufferOwned,
				}),
			}
		}
	}

	return methods
}
