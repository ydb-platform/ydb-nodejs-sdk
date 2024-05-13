import {NotFound} from "../errors";
import {Endpoint} from "../discovery";

export interface Pessimizable {
    endpoint: Endpoint;
}

/**
 * The jrpc session connection is pessimized in case of errors on keepALive for the table service and in case the alive connection is broken
 * in the query service.  The session remains in the pool.  Pessimization is removed after discovery serv information is updated.
 */
export function pessimizable(_target: Pessimizable, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (this: Pessimizable, ...args: any) {
        try {
            return await originalMethod.call(this, ...args);
        } catch (error) {
            if (!(error instanceof NotFound)) {
                this.endpoint.pessimize();
            }
            throw error;
        }
    };
    return descriptor;
}
