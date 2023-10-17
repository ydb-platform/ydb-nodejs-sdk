import config from './jest.config.unit';

/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

console.info(1000, config)

module.exports = {
    ...config,
    collectCoverage: true,
    collectCoverageFrom: [
        '**/*.{js,ts}'
    ],
    coverageDirectory: '../coverage'
};
