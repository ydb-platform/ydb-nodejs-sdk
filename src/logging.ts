import pino, {Logger, LoggerOptions} from 'pino';


const LOGLEVEL = process.env.YDB_SDK_LOGLEVEL || 'info';
const PRETTY_LOGS = Boolean(process.env.YDB_SDK_PRETTY_LOGS);
let logger: Logger|null = null;

const defaultLoggerOptions = {
    level: LOGLEVEL,
    prettyPrint: PRETTY_LOGS,
}

export default function getLogger(options: LoggerOptions = defaultLoggerOptions) {
    if (!logger) {
        logger = pino(options);
    }
    return logger;
}

export {Logger} from 'pino';
