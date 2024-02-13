export function getDatabaseHeader(database: string): [string, string] {
    return ['x-ydb-database', database];
}
