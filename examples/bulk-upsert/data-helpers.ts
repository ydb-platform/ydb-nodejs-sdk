import {declareType, TypedData, Ydb} from 'ydb-sdk';

export interface ILogMessage {
    app: string;
    host: string;
    timestamp: Date;
    httpCode: number;
    message: string;
}

export class LogMessage extends TypedData {
    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public app: string;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public host: string;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.TIMESTAMP})
    public timestamp: Date;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UINT32})
    public httpCode: number;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
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
