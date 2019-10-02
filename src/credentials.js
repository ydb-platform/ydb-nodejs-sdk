const fs = require('fs');
const path = require('path');
const grpc = require('grpc');


function readToken(pathname) {
    if (fs.existsSync(pathname)) {
        const token = fs.readFileSync(pathname);
        return String(token).trim();
    } else {
        return '';
    }
}

const OAUTH_TOKEN = readToken(path.resolve(__dirname, '../secrets/oauth.token'));

function getCredentialsMetadata(token = OAUTH_TOKEN) {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', OAUTH_TOKEN);
    return metadata;
}

module.exports = {
    getCredentialsMetadata
};
