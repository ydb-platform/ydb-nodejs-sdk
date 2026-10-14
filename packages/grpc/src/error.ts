import { Metadata, status as Status } from '@grpc/grpc-js'

export { Status }

export class ClientError extends Error {
	readonly path: string
	readonly code: Status
	readonly details: string

	constructor(path: string, code: Status, details: string) {
		super(`${path} ${Status[code]}: ${details}`)
		this.name = 'ClientError'
		this.path = path
		this.code = code
		this.details = details

		// Existing middleware may still check errors against nice-grpc's constructor.
		Object.defineProperties(this, {
			'@@nice-grpc': { value: true },
			'@@nice-grpc:ClientError': { value: true },
		})
	}

	static override [Symbol.hasInstance](value: unknown): boolean {
		if (this !== ClientError) {
			return (
				typeof value === 'object' && value !== null && this.prototype.isPrototypeOf(value)
			)
		}

		if (typeof value !== 'object' || value === null) {
			return false
		}

		return (
			value.constructor === ClientError ||
			('@@nice-grpc:ClientError' in value && value['@@nice-grpc:ClientError'] === true) ||
			('name' in value &&
				value.name === 'ClientError' &&
				'@@nice-grpc' in value &&
				value['@@nice-grpc'] === true)
		)
	}
}

export function wrapClientError(error: unknown, path: string): unknown {
	if (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		typeof error.code === 'number' &&
		'details' in error &&
		typeof error.details === 'string' &&
		'metadata' in error &&
		error.metadata instanceof Metadata
	) {
		return new ClientError(path, error.code, error.details)
	}

	return error
}
