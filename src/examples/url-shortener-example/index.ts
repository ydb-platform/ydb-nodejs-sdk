import Driver from '../../driver';
import {getCredentialsFromEnv} from "../../parse-env-vars";
import {Logger} from "../../logging";
import {main} from '../utils';
import {indexPageContent} from "./index.html";

import {UrlsMatch, RequestSourceUrl} from "./data-helpers";
import {createTable, createShorten, selectSource} from "./database";

import express from "express";
import * as http from "http";


const HOST = (process.env.HOST || 'localhost');
const PORT = parseInt(process.env.PORT || '3000');

const API_PREFIX = '/url';

const BASE_URL = (process.env.USE_SSL ? 'https:\/\/' : 'http:\/\/') +
    ( (PORT == 443 || PORT == 80) ? HOST : `${HOST}:${PORT}` ) +
    API_PREFIX;


async function run(logger: Logger, entryPoint: string, dbName: string) {
    const authService = getCredentialsFromEnv(entryPoint, dbName, logger);
    logger.debug('Driver initializing...');
    const driver = new Driver(entryPoint, dbName, authService);
    const timeout = 10000;
    if (!await driver.ready(timeout)) {
        logger.fatal(`Driver has not become ready in ${timeout}ms!`);
        process.exit(1);
    }

    await driver.tableClient.withSession(async (session) => {
        await createTable(session, logger);
    })

    const app: express.Application = express();
    app.use(express.json());

    app.get('/', async function(_, res) : Promise<void> {
        await res.send(indexPageContent);
    });

    app.get(API_PREFIX + '/:shorten', async function(req, res) : Promise<void> {
        if (RequestSourceUrl.isShortenCorrect(req.params.shorten || '') ) {
            await driver.tableClient.withSession(async (session) => {
                const source = await selectSource(req.params.shorten, dbName, session, logger);
                // await res.status(200).send(source);
                await res.writeHead(301, {
                    Location: source
                });
                res.end();
            });
        } else {
            await res.status(400).send('Bad Request');
        }
    });

    app.post(API_PREFIX, async function(req, res) : Promise<void> {
        if (UrlsMatch.isSourceUrlCorrect(req.body.source || '')) {
            await driver.tableClient.withSession(async (session) => {
                const shorten = await createShorten(req.body.source, dbName, session, logger);
                await res.status(200).send(BASE_URL + '/' + shorten);
            });
        } else {
            await res.status(400).send('Bad Request');
        }
    });

    const server = new http.Server(app);
    server.listen(PORT, '0.0.0.0', async function() {
        logger.info('Server starting.');
        logger.info('Listening on port', PORT);
    });
}

main(run);
