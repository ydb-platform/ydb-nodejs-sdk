import url from 'url';

export interface ParsedConnectionString {
    endpoint: string;
    database: string;
}

export function parseConnectionString(connectionString: string): ParsedConnectionString {
    let cs = connectionString;
    if (!cs.startsWith('grpc://') && !cs.startsWith('grpcs://') ){
        cs = 'grpcs://' + cs;
    }

    let parsedUrl = url.parse(cs, true);
    let databaseParam = parsedUrl.query['database'];

    let database;
    if (databaseParam === undefined) {
        throw new Error('unknown database');
    } else if (Array.isArray(databaseParam)) {
        if (databaseParam.length === 0) {
            throw new Error('unknown database');
        }
        database = databaseParam[0];
    } else {
        database = databaseParam;
    }

    const host = parsedUrl.host || 'localhost';

    return {
        endpoint: `${parsedUrl.protocol}//${host}`,
        database,
    };
}
