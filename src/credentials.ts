import fs from 'fs';
import path from 'path';
import grpc from 'grpc';


function readToken(pathname: string) {
    if (fs.existsSync(pathname)) {
        const token = fs.readFileSync(pathname);
        return String(token).trim();
    } else {
        return '';
    }
}

const OAUTH_TOKEN = readToken(path.resolve(__dirname, '../secrets/oauth.token'));

export function getCredentialsMetadata(token = OAUTH_TOKEN) {
    const metadata = new grpc.Metadata();
    metadata.add('x-ydb-auth-ticket', token);
    return metadata;
}
