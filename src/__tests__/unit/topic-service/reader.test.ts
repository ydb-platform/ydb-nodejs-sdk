import {TopicReader} from "../../../topic/topic-reader";
import {pushReadResponse} from "../../../topic/symbols";

describe('topic > reder', () => {

    let readerStream: TopicReader;

    beforeEach(async () => {
        // readerStream = new TopicReader({
        //     consumer: 'testConsumer',
        //     readerName: 'testReader',
        //     topicsReadSettings: {
        //
        //     }
        // })
        // TODO: Create queue
    });

    it('empty queue', async () => {
        let cnt = 0;
        await readerStream.next().then(() => {
            cnt++;
        });
        setTimeout(() => {
            expect(cnt).toBe(0);
        }, 0);
    });

    it('full queue', async () => {
        readStream[pushReadResponse]({

        });


    });

    it('wait for next message', async () => {

    });

    it('close', async () => {

    });

    it('error', async () => {

    });


});
