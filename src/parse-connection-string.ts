import url from 'url';

export interface ParsedConnectionString {
    endpoint: string;
    database: string;
}

export const parseConnectionString = (connectionString: string): ParsedConnectionString => {
    let cs = connectionString;

    if (!cs.startsWith('grpc://') && !cs.startsWith('grpcs://')) {
        cs = `grpcs://${cs}`;
    }

    const parsedUrl = url.parse(cs, true);
    const databaseParam = parsedUrl.query.database;

    let database;

    if (databaseParam === undefined) {
        throw new Error('unknown database');
    } else if (Array.isArray(databaseParam)) {
        if (databaseParam.length === 0) {
            throw new Error('unknown database');
        }
        // eslint-disable-next-line prefer-destructuring
        database = databaseParam[0];
    } else {
        database = databaseParam;
    }

    const host = parsedUrl.host || 'localhost';

    return {
        endpoint: `${parsedUrl.protocol}//${host}`,
        database,
    };
};
