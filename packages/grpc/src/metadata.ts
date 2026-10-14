import { Metadata as GrpcMetadata } from '@grpc/grpc-js'

export type MetadataValue<Key extends string> = string extends Key
	? string | Uint8Array
	: Lowercase<Key> extends `${string}-bin`
		? Uint8Array
		: string

export type Metadata = {
	set<Key extends string>(
		key: Key,
		value: MetadataValue<Key> | Array<MetadataValue<Key>>
	): Metadata
	append<Key extends string>(key: Key, value: MetadataValue<Key>): Metadata
	delete(key: string): void
	get<Key extends string>(key: Key): MetadataValue<Key> | undefined
	getAll<Key extends string>(key: Key): Array<MetadataValue<Key>>
	has(key: string): boolean
	[Symbol.iterator](): IterableIterator<[string, Array<string | Uint8Array>]>
}

export type MetadataInit =
	| Metadata
	| Iterable<[string, string | Uint8Array | Array<string | Uint8Array>]>
	| Record<string, string | Uint8Array | Array<string | Uint8Array>>

export type MetadataConstructor = {
	new (init?: MetadataInit): Metadata
	(init?: MetadataInit): Metadata
}

export let Metadata = function (init?: MetadataInit): Metadata {
	let data = new Map<string, Array<string | Uint8Array>>()
	let metadata: Metadata = {
		set(key, value) {
			let name = key.toLowerCase()
			let values = Array.isArray(value) ? value : [value]

			for (let item of values) {
				validate(name, item)
			}

			if (values.length === 0) {
				data.delete(name)
			} else {
				data.set(name, name.endsWith('-bin') ? values : [values.join(', ')])
			}

			return metadata
		},
		append(key, value) {
			let name = key.toLowerCase()
			validate(name, value)

			let values = data.get(name) ?? []
			values.push(value)
			data.set(name, name.endsWith('-bin') ? values : [values.join(', ')])

			return metadata
		},
		delete(key) {
			data.delete(key.toLowerCase())
		},
		get<Key extends string>(key: Key) {
			return data.get(key.toLowerCase())?.[0] as MetadataValue<Key> | undefined
		},
		getAll<Key extends string>(key: Key) {
			return (data.get(key.toLowerCase()) ?? []) as Array<MetadataValue<Key>>
		},
		has(key) {
			return data.has(key.toLowerCase())
		},
		[Symbol.iterator]() {
			return data[Symbol.iterator]()
		},
	}

	if (init !== undefined && init !== null) {
		let entries = Symbol.iterator in init ? init : Object.entries(init)

		for (let [key, value] of entries) {
			metadata.set(key, value)
		}
	}

	return metadata
} as MetadataConstructor

function validate(key: string, value: string | Uint8Array): void {
	if (!/^[0-9a-z_.-]+$/.test(key)) {
		throw new Error(`Metadata key '${key}' contains illegal characters`)
	}

	if (key.endsWith('-bin')) {
		if (!(value instanceof Uint8Array)) {
			throw new Error(
				`Metadata key '${key}' ends with '-bin', thus it must have binary value`
			)
		}
	} else {
		if (typeof value !== 'string') {
			throw new Error(
				`Metadata key '${key}' doesn't end with '-bin', thus it must have string value`
			)
		}

		if (!/^[ -~]*$/.test(value)) {
			throw new Error(`Metadata value of key '${key}' contains illegal characters`)
		}
	}
}

export function toGrpcMetadata(metadata?: Metadata): GrpcMetadata {
	let result = new GrpcMetadata()

	for (let [key, values] of metadata ?? []) {
		for (let value of values) {
			result.add(key, typeof value === 'string' ? value : Buffer.from(value))
		}
	}

	return result
}

export function fromGrpcMetadata(metadata: GrpcMetadata): Metadata {
	let result = Metadata()

	for (let key of Object.keys(metadata.getMap())) {
		result.set(key, metadata.get(key))
	}

	return result
}
