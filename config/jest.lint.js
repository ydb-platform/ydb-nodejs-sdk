module.exports = {
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig-cjs.json',
        },
    },
    roots: ['<rootDir>/../eslint-local-rules/rules/'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '/(.*/)*.*\.(spec|test).(j|t)sx?$',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
