import pino, {Logger, LoggerOptions} from 'pino';


const LOGLEVEL = process.env.YDB_SDK_LOGLEVEL || 'info';
let logger: Logger|null = null;

export default function getLogger(options: LoggerOptions = {level: LOGLEVEL}) {
    if (!logger) {
        logger = pino(options);
    }
    return logger;
}

export {Logger} from 'pino';
