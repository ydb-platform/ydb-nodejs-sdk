const pkgPath = process.env.TEST_ENVIRONMENT === 'dev' ? '../package.json' : '../../package.json';
const pkgInfo = require(pkgPath);

function getVersion() {
    return pkgInfo.version;
}

function getLibraryName() {
    return `ydb-nodejs-sdk/${getVersion()}`;
}

export function getVersionHeader(): [string, string] {
    return ['x-ydb-sdk-build-info', getLibraryName()];
}
