import {AnonymousAuthService, Driver as YDB} from '../..';

describe('using keyword', () => {
    it('general', async () => {
        await using ydb = new YDB({
            authService: new AnonymousAuthService(),
            connectionString: 'grpc://localhost:2136/?database=local',
        });

        const res = await ydb.queryClient.do({
            fn: async (session) => {
                const rs = await session.execute({
                    text: 'SELECT 1;'
                });
                for await (const s of rs.resultSets) {
                    for await (const r of s.rows) {
                        return r;
                    }
                }
            }
        });

        expect(res).toEqual({
            // TODO
        })

    });
});
