import {Column, Session, TableDescription} from "../../src/table";
import {Logger} from "../../src/logging";
import {Ydb} from "../../proto/bundle";
import {RequestSourceUrl, UrlsMatch} from "./data-helpers";
import {withRetries} from "../../src/retries";

const URLS_TABLE = 'urls';

export async function createTable(session: Session, logger: Logger) : Promise<void> {
    logger.info('Creating table: ' + URLS_TABLE);

    await session.createTable(
        URLS_TABLE,
        new TableDescription()
            .withColumn(
                new Column(
                    'shorten',
                    Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
                ))
            .withColumn(
                new Column(
                    'source',
                    Ydb.Type.create({optionalType: {item: {typeId: Ydb.Type.PrimitiveTypeId.UTF8}}})
                ))
            .withPrimaryKey('shorten')
    );

    logger.info('Finished creating table: ' + URLS_TABLE);
}


export async function createShorten(sourceUrl: string, tablePathPrefix: string,
                                    session: Session, logger: Logger) : Promise<string> {
    const shortenUrl = UrlsMatch.calculateShortenUrl(sourceUrl);
    const query = `
PRAGMA TablePathPrefix("${tablePathPrefix}");

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


export async function selectSource(shortenUrl: string, tablePathPrefix: string,
                                   session: Session, logger: Logger): Promise<string> {
    const query = `
    PRAGMA TablePathPrefix("${tablePathPrefix}");

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
        logger.info('Select prepared query', result);
        if (result.length == 0) {
            return '';
        } else {
            return result[0].source;
        }
    }

    return await withRetries(execute);
}
