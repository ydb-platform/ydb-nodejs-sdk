import { expect, test } from 'vitest'

import { camelCaseColumnName } from './column-name.js'

test('converts single underscores between ASCII name segments', () => {
	expect(camelCaseColumnName('author_id')).toBe('authorId')
	expect(camelCaseColumnName('book_id')).toBe('bookId')
	expect(camelCaseColumnName('release_year')).toBe('releaseYear')
	expect(camelCaseColumnName('long_column_name')).toBe('longColumnName')
	expect(camelCaseColumnName('version2_name')).toBe('version2Name')
})

test('preserves qualifiers and leading or repeated underscores', () => {
	expect(camelCaseColumnName('b.book_id')).toBe('b.bookId')
	expect(camelCaseColumnName('book_alias.book_id')).toBe('book_alias.bookId')
	expect(camelCaseColumnName('_author_id')).toBe('_authorId')
	expect(camelCaseColumnName('__author_id')).toBe('__authorId')
	expect(camelCaseColumnName('foo__bar')).toBe('foo__bar')
	expect(camelCaseColumnName('foo_')).toBe('foo_')
})

test('preserves empty names and existing capitalization', () => {
	expect(camelCaseColumnName('')).toBe('')
	expect(camelCaseColumnName('authorId')).toBe('authorId')
	expect(camelCaseColumnName('URL_value')).toBe('URLValue')
	expect(camelCaseColumnName('user_ID')).toBe('user_ID')
	expect(camelCaseColumnName('USER_ID')).toBe('USER_ID')
})
