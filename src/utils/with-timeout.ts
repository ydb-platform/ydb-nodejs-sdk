import {TimeoutExpired} from "../errors";

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timedRejection: Promise<never> = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutExpired(`Timeout of ${timeoutMs}ms has expired`));
        }, timeoutMs);
    });
    return Promise.race([promise.finally(() => {
        clearTimeout(timeoutId);
    }), timedRejection]);
}
