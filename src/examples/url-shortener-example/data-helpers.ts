import {declareType, TypedData} from "../../types";
import {Ydb} from "../../../proto/bundle";

const SOURCE_URL_REGEX = new RegExp("https?://(?:[-\\w.]|(?:%[\\da-fA-F]{2}))+");
const SHORTEN_REGEX = new RegExp("[a-zA-Z0-9]");

let crc = require('crc');

interface IUrlsMatch {
    shorten: string,
    source: string
}
export class UrlsMatch extends TypedData {
    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public shorten: string;

    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public source: string;

    static isSourceUrlCorrect(sourceUrl: string): boolean {
        return !(sourceUrl.match(SOURCE_URL_REGEX) === null);
    }

    static calculateShortenUrl(sourceUrl: string): string {
        return crc.crc32(sourceUrl, 0).toString(16);
    }

    static create(shorten: string, source: string): UrlsMatch {
        return new this({shorten, source});
    }

    constructor(data: IUrlsMatch) {
        super(data);
        this.shorten = data.shorten;
        this.source = data.source;
    }
}


interface IRequestSourceUrl {
    shorten: string
}
export class RequestSourceUrl extends TypedData {
    @declareType({typeId: Ydb.Type.PrimitiveTypeId.UTF8})
    public shorten: string;

    static isShortenCorrect(shorten: string): boolean {
        return !(shorten.match(SHORTEN_REGEX) === null);
    }

    static create(shorten: string): RequestSourceUrl {
        return new this({shorten});
    }

    constructor(data: IRequestSourceUrl) {
        super(data);
        this.shorten = data.shorten;
    }
}
