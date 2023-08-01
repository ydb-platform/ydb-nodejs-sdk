module.exports = {
    ...require('./jest.config.development'),
    collectCoverage: true,
    collectCoverageFrom: [
        '**/*.{js,ts}',
        '!generated/**',
    ],
    coverageDirectory: 'coverage',
}
