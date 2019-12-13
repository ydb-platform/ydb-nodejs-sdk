import pino, {Logger, LoggerOptions} from 'pino';


let logger: Logger|null = null;

export default function getLogger(options: LoggerOptions = {level: 'debug'}) {
    if (!logger) {
        logger = pino(options);
    }
    return logger;
}

export {Logger} from 'pino';
