import { IAuthService, IIamCredentials } from './credentials';
import { Logger } from './logging';
export declare function getSACredentialsFromJson(filename: string): IIamCredentials;
export declare function getCredentialsFromEnv(logger?: Logger): IAuthService;
