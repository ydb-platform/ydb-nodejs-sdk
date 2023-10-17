module.exports = {
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig-cjs.json'
        }
    },
    roots: ['<rootDir>/../src'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '/__tests__/unit/(.*/)*.*\.(spec|test).(j|t)sx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node']
}
