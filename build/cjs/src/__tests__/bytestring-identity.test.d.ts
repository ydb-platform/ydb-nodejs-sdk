/// <reference types="node" />
import { Session } from '../table';
import { TypedData } from '../types';
export interface IRow {
    id: number;
    field1: string;
    field2: Buffer;
    field3: Buffer;
}
declare class Row extends TypedData {
    id: number;
    field1: string;
    field2: Buffer;
    field3: Buffer;
    constructor(data: IRow);
}
export declare function fillTableWithData(session: Session, rows: Row[]): Promise<void>;
export {};
