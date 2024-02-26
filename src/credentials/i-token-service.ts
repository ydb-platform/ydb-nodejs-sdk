interface ITokenServiceYC {
    getToken: () => Promise<string>;
}

export interface ITokenServiceCompat {
    getToken: () => string | undefined;
    initialize?: () => Promise<void>;
}

export type ITokenService = ITokenServiceYC | ITokenServiceCompat;
