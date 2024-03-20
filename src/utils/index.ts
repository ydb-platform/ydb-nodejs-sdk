// Note: Explicit enumeration is used so that jest.spyOn() can replace utils.<item> with mock.  If you specify
// thru asterisk, TypeScript moves these properties to utils as unmodifiable properties

export {StreamEnd, AuthenticatedService, GrpcService, ClientOptions, MetadataHeaders} from './authenticated-service';
export {Pessimizable, pessimizable} from './pessimizable';
export {sleep} from './sleep';
export {toLong} from './to-long';
export {withTimeout} from './with-timeout';
