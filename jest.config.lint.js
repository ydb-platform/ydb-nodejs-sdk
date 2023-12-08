module.exports = {
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig-cjs.json'
        }
    },
    roots: ['<rootDir>/eslint-local-rules'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '(/rules/.*|(\\.|/)(test|spec))\\.tsx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}
