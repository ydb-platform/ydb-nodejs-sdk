const pkgInfo = require('../package.json');

function getVersion() {
    return pkgInfo.version;
}

function getLibraryName() {
    return `ydb-nodejs-sdk/${getVersion()}`;
}

export function getVersionHeader(): [string, string] {
    return ['x-ydb-sdk-build-info', getLibraryName()];
}
