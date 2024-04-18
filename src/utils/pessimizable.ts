import {NotFound} from "../retries/errors";
import {Endpoint} from "../discovery";

export interface Pessimizable {
    endpoint: Endpoint;
}

export function pessimizable(_target: Pessimizable, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (this: Pessimizable, ...args: any) {
        try {
            return await originalMethod.call(this, ...args);
        } catch (error) {
            if (!(error instanceof NotFound)) {
                this.endpoint.pessimize(); // TODO: Does not seems right. Check pessimizable
            }
            throw error;
        }
    };
    return descriptor;
}
