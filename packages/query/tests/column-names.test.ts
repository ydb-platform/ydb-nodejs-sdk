import { expect, inject, test } from 'vitest'

import { Driver } from '@ydbjs/core'

import { query } from '../src/index.js'

test('preserves column names when no mapper is configured', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using sql = query(driver)

	expect(await sql`SELECT 1 AS author_id`.signal(tc.signal)).toEqual([[{ author_id: 1 }]])
})

test('maps object keys without rewriting SQL or nested struct members', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using sql = query(driver, { mapColumnName: 'camelCase' })
	let stmt = sql<[{ authorId: number; authorDetails: { first_name: string } }]>`
		SELECT 1 AS author_id, <|first_name: 'Alice'u|> AS author_details
	`.signal(tc.signal)

	expect(stmt.text).toContain('AS author_id')
	expect(await stmt).toEqual([[{ authorId: 1, authorDetails: { first_name: 'Alice' } }]])
})

test('maps keys in every result set and row', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using sql = query(driver, { mapColumnName: (name) => name.toUpperCase() })

	expect(
		await sql`SELECT 1 AS id UNION ALL SELECT 2 AS id ORDER BY id; SELECT 3 AS other;`.signal(
			tc.signal
		)
	).toEqual([[{ ID: 1 }, { ID: 2 }], [{ OTHER: 3 }]])
})

test('maps raw row keys without decoding their values', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using original = query(driver)
	await using mapped = query(driver, { mapColumnName: () => 'authorId' })
	let [[row]] = await original<[{ author_id: unknown }]>`SELECT 1 AS author_id`
		.raw()
		.signal(tc.signal)

	expect(await mapped`SELECT 1 AS author_id`.raw().signal(tc.signal)).toEqual([
		[{ authorId: row!.author_id }],
	])
})

test('does not call the mapper for positional values or raw values', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using original = query(driver)
	await using sql = query(driver, {
		mapColumnName: () => {
			throw new Error('Mapper must not run for values()')
		},
	})

	expect(await sql`SELECT 1 AS id`.values().signal(tc.signal)).toEqual([[[1]]])
	expect(await sql`SELECT 1 AS id`.values().raw().signal(tc.signal)).toEqual(
		await original`SELECT 1 AS id`.values().raw().signal(tc.signal)
	)
})

test('propagates column mapping into transactions', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using sql = query(driver, { mapColumnName: 'camelCase' })

	expect(
		await sql.begin({ signal: tc.signal }, (tx) =>
			tx`SELECT 1 AS author_id`.then((rows) => rows)
		)
	).toEqual([[{ authorId: 1 }]])
})

test('rejects collisions between snake_case and camelCase column names', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using sql = query(driver, { mapColumnName: 'camelCase' })

	await expect(sql`SELECT 1 AS author_id, 2 AS authorId`.signal(tc.signal)).rejects.toThrow(
		'Duplicate mapped column name: authorId'
	)
})

test('rejects mapped column collisions even for an empty result set', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using sql = query(driver, { mapColumnName: () => 'id' })

	await expect(sql`SELECT 1 AS first_id, 2 AS second_id`.signal(tc.signal)).rejects.toThrow(
		'Duplicate mapped column name: id'
	)
	await expect(
		sql`SELECT * FROM AS_TABLE([<|first_id: 1, second_id: 2|>]) WHERE FALSE`.signal(tc.signal)
	).rejects.toThrow('Duplicate mapped column name: id')
})

test('keeps special mapped names as own data properties', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	await using sql = query(driver, { mapColumnName: () => '__proto__' })
	let [[row]] = await sql`SELECT 1 AS id`.signal(tc.signal)

	expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
	expect(Object.getOwnPropertyDescriptor(row, '__proto__')).toEqual({
		value: 1,
		enumerable: true,
		writable: true,
		configurable: true,
	})
})

test('propagates mapper errors without retrying', async (tc) => {
	await using driver = new Driver(inject('connectionString'))
	let error = new TypeError('Unsupported column')
	let calls = 0
	await using sql = query(driver, {
		mapColumnName: () => {
			calls++
			throw error
		},
	})

	await expect(sql`SELECT 1 AS id`.signal(tc.signal)).rejects.toBe(error)
	expect(calls).toBe(1)
})
