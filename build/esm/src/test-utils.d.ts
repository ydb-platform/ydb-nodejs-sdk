import Driver, { IDriverSettings } from "./driver";
import { TypedData } from "./types";
import { Session } from "./table";
export declare const TABLE: string;
export interface IRow {
    id: number;
    title: string;
}
export declare class Row extends TypedData {
    id: number;
    title: string;
    constructor(data: IRow);
}
export declare function initDriver(settings?: Partial<IDriverSettings>): Promise<Driver>;
export declare function destroyDriver(driver: Driver): Promise<void>;
export declare function createTable(session: Session): Promise<void>;
export declare function fillTableWithData(session: Session, rows: Row[]): Promise<void>;
