import {Column, Session, TableDescription, Logger, withRetries, Types} from 'ydb-sdk';
import {RequestSourceUrl, UrlsMatch} from "./data-helpers";
import {SYNTAX_V1} from "../utils";

const URLS_TABLE = 'urls';

export async function createTable(session: Session, logger: Logger) : Promise<void> {
    logger.info('Creating table: ' + URLS_TABLE);

    await session.createTable(
        URLS_TABLE,
        new TableDescription()
            .withColumn(
                new Column(
                    'shorten',
                    Types.optional(Types.UTF8),
                ))
            .withColumn(
                new Column(
                    'source',
                    Types.optional(Types.UTF8),
                ))
            .withPrimaryKey('shorten')
    );

    logger.info('Finished creating table: ' + URLS_TABLE);
}


export async function createShorten(
    sourceUrl: string,
    session: Session,
    logger: Logger) : Promise<string> {
    const shortenUrl = UrlsMatch.calculateShortenUrl(sourceUrl);
    const query = `
${SYNTAX_V1}
DECLARE $shortenUrl as Utf8;
DECLARE $sourceUrl as Utf8;

REPLACE INTO ${URLS_TABLE} (shorten, source)
VALUES ($shortenUrl, $sourceUrl);`;

    async function execute() {
        logger.info('inserting a new record');
        const preparedQuery = await session.prepareQuery(query);
        const urlsMatch = new UrlsMatch({shorten: shortenUrl, source: sourceUrl});
        await session.executeQuery(preparedQuery, {
            '$shortenUrl': urlsMatch.getTypedValue('shorten'),
            '$sourceUrl': urlsMatch.getTypedValue('source')
        });
    }
    await withRetries(execute);
    return shortenUrl;
}

export async function selectSource(
    shortenUrl: string,
    session: Session,
    logger: Logger): Promise<string> {
    const query = `
    ${SYNTAX_V1}
DECLARE $shortenUrl as Utf8;

SELECT *
FROM ${URLS_TABLE}
WHERE shorten = $shortenUrl;`;

    async function execute() : Promise<string> {
        logger.info('Preparing query...');
        const preparedQuery = await session.prepareQuery(query);
        logger.info('Selecting prepared query...');
        const requestSourceUrl = new RequestSourceUrl({shorten: shortenUrl});
        const {resultSets} = await session.executeQuery(preparedQuery, {
            '$shortenUrl': requestSourceUrl.getTypedValue('shorten')
        });
        const result = UrlsMatch.createNativeObjects(resultSets[0]);
        logger.info('Parametrized select query', result);
        if (result.length == 0) {
            return '';
        } else {
            return result[0].source;
        }
    }

    return await withRetries(execute);
}
