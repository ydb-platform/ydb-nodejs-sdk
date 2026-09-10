export function camelCaseColumnName(name: string): string {
	let fieldStart = name.lastIndexOf('.') + 1
	return (
		name.slice(0, fieldStart) +
		name
			.slice(fieldStart)
			.replace(/(?<=[A-Za-z0-9])_([a-z])/g, (_, letter: string) => letter.toUpperCase())
	)
}
