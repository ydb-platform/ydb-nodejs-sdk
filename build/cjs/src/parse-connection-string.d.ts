export interface ParsedConnectionString {
    endpoint: string;
    database: string;
}
export declare function parseConnectionString(connectionString: string): ParsedConnectionString;
