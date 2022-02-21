import {declareType, TypedData, Types, snakeToCamelCaseConversion, withTypeOptions} from 'ydb-sdk';

export interface ILogMessage {
    app: string;
    host: string;
    timestamp: Date;
    httpCode: number;
    message: string;
}

@withTypeOptions({namesConversion: snakeToCamelCaseConversion})
export class LogMessage extends TypedData {
    @declareType(Types.UTF8)
    public app: string;

    @declareType(Types.UTF8)
    public host: string;

    @declareType(Types.TIMESTAMP)
    public timestamp: Date;

    @declareType(Types.UINT32)
    public httpCode: number;

    @declareType(Types.UTF8)
    public message: string;

    static create(app: string, host: string, timestamp: Date, httpCode: number, message: string) {
        return new this({app, host, timestamp, httpCode, message});
    }

    constructor(data: ILogMessage) {
        super(data);
        this.app = data.app;
        this.host = data.host;
        this.timestamp = data.timestamp;
        this.httpCode = data.httpCode;
        this.message = data.message;
    }
}
