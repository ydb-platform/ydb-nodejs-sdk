import Driver from '../../driver'

async function Main() {

    // TODO; Add service to Driver
    const ydb = new Driver({
        // endpoint: '...',
        // database: '...',
        // connectionString: '...',
        // authService: ...,
        // poolSettings: ...,
        // sslCredentials: ...,
        // clientOptions: ...,
        // logger: ...,
        // tracing settings
        // timeout
    });

    ydb.query.do<R>({ // R sample of DataType
        traceId: ...,
        txControl: ...,
        syntax: ...,
        retryPolicy: ..., // ???
        statement: ???, // Is it. It's likely
        handler: ... // session handler
    })

    // TODO: Support dataType to convert?




}

Main()
