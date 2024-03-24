module.exports = {
    roots: ['<rootDir>/src'],
    preset: 'ts-jest',
    transform: {
        '^.+\\.{ts|tsx}?$': ['ts-jest', {
            tsConfig: 'tsconfig.json',
        }],
    },
    testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
}
