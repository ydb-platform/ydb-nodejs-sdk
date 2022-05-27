import path from 'path';

export function getRelTopLevelPath() {
    return process.env.TEST_ENVIRONMENT === 'dev' ? '..' : '../..';
}

const pkgInfo = require(path.join(getRelTopLevelPath(), 'package.json'));

function getVersion() {
    return pkgInfo.version;
}

function getLibraryName() {
    return `ydb-nodejs-sdk/${getVersion()}`;
}

export function getVersionHeader(): [string, string] {
    return ['x-ydb-sdk-build-info', getLibraryName()];
}
