import {AnonymousAuthService, Driver as YDB} from '../..';

describe('using keyword', () => {
    it('general', async () => {
        await using ydb = new YDB({
            authService: new AnonymousAuthService(),
            connectionString: 'grpc://localhost:2136/?database=local',
        });

        const res = await ydb.queryClient.do({
            fn: async (session) => {
                return session.execute({
                    text: 'SELECT 1;'
                })
            }
        });

        expect(res).toEqual({
            // TODO
        })

    });
});
