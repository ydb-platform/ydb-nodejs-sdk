import pkgInfo from '../package.json';

const getVersion = () => pkgInfo.version;

const getLibraryName = () => `ydb-nodejs-sdk/${getVersion()}`;

export const getVersionHeader = (): [string, string] => ['x-ydb-sdk-build-info', getLibraryName()];
