import { NotFound } from '../errors';
import { Pessimizable } from './service-base-classes';

export function pessimizable(_target: Pessimizable, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any
    descriptor.value = /* async */ function pessimizableImpl(this: Pessimizable, ...args: any) {
        try {
            return /* await */ originalMethod.call(this, ...args);
        } catch (error) {
            if (!(error instanceof NotFound)) {
                this.endpoint.pessimize();
            }
            throw error;
        }
    };

    return descriptor;
}
