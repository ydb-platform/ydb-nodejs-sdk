import {declareType, TypedData, Types} from 'ydb-sdk';

interface ISeries {
    series_id: number;
    title: string;
    release_date: Date;
    series_info: string;
}
export class Series extends TypedData {
    @declareType(Types.UINT64)
    public series_id!: number;

    @declareType(Types.UTF8)
    public title!: string;

    @declareType(Types.DATE)
    public release_date!: Date;

    @declareType(Types.UTF8)
    public series_info!: string;

    static create(series_id: number, title: string, release_date: Date, series_info: string): Series {
        return new this({series_id, title, release_date, series_info});
    }

    constructor(data: ISeries) {
        super(data);
    }
}

export function getSeriesData() {
    return Series.asTypedCollection([
        Series.create(1, "IT Crowd", new Date("2006-02-03"),
            "The IT Crowd is a British sitcom produced by Channel 4, written by Graham Linehan, produced by " +
            "Ash Atalla and starring Chris O'Dowd, Richard Ayoade, Katherine Parkinson, and Matt Berry."),
        Series.create(2, "Silicon Valley",  new Date("2014-04-06"),
            "Silicon Valley is an American comedy television series created by Mike Judge, John Altschuler and " +
            "Dave Krinsky. The series focuses on five young men who founded a startup company in Silicon Valley.")
    ]);
}
