import {Ydb, declareType, TypedData} from 'ydb-sdk';
import Type = Ydb.Type;

interface ISeries {
    seriesId: number;
    title: string;
    releaseDate: Date;
    seriesInfo: string;
}
export class Series extends TypedData {
    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seriesId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public title: string;

    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public releaseDate: Date;

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public seriesInfo: string;

    static create(seriesId: number, title: string, releaseDate: Date, seriesInfo: string): Series {
        return new this({seriesId, title, releaseDate, seriesInfo});
    }

    constructor(data: ISeries) {
        super(data);
        this.seriesId = data.seriesId;
        this.title = data.title;
        this.releaseDate = data.releaseDate;
        this.seriesInfo = data.seriesInfo;
    }
}

interface IEpisode {
    seriesId: number;
    seasonId: number;
    episodeId: number;
    title: string;
    airDate: Date;
}
export class Episode extends TypedData {
    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seriesId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seasonId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public episodeId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public title: string;

    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public airDate: Date;

    static create(seriesId: number, seasonId: number, episodeId: number, title: string, airDate: Date): Episode {
        return new this({seriesId, seasonId, episodeId, title, airDate});
    }

    constructor(data: IEpisode) {
        super(data);
        this.seriesId = data.seriesId;
        this.seasonId = data.seasonId;
        this.episodeId = data.episodeId;
        this.title = data.title;
        this.airDate = data.airDate;
    }
}

interface ISeason {
    seriesId: number;
    seasonId: number;
    title: string;
    firstAired: Date;
    lastAired: Date;
}
export class Season extends TypedData {
    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seriesId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seasonId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public title: string;

    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public firstAired: Date;

    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public lastAired: Date;

    static create(seriesId: number, seasonId: number, title: string, firstAired: Date, lastAired: Date): Season {
        return new this({seriesId, seasonId, title, firstAired, lastAired});
    }

    constructor(data: ISeason) {
        super(data);
        this.seriesId = data.seriesId;
        this.seasonId = data.seasonId;
        this.title = data.title;
        this.firstAired = data.firstAired;
        this.lastAired = data.lastAired;
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

export function getSeasonsData() {
    return Season.asTypedCollection([
        Season.create(1, 1, "Season 1", new Date("2006-02-03"), new Date("2006-03-03")),
        Season.create(1, 2, "Season 2", new Date("2007-08-24"), new Date("2007-09-28")),
        Season.create(1, 3, "Season 3", new Date("2008-11-21"), new Date("2008-12-26")),
        Season.create(1, 4, "Season 4", new Date("2010-06-25"), new Date("2010-07-30")),
        Season.create(2, 1, "Season 1", new Date("2014-04-06"), new Date("2014-06-01")),
        Season.create(2, 2, "Season 2", new Date("2015-04-12"), new Date("2015-06-14")),
        Season.create(2, 3, "Season 3", new Date("2016-04-24"), new Date("2016-06-26")),
        Season.create(2, 4, "Season 4", new Date("2017-04-23"), new Date("2017-06-25")),
        Season.create(2, 5, "Season 5", new Date("2018-03-25"), new Date("2018-05-13"))
    ]);
}

export function getEpisodesData() {
    return Episode.asTypedCollection([
        Episode.create(1, 1, 1, "Yesterday's Jam", new Date("2006-02-03")),
        Episode.create(1, 1, 2, "Calamity Jen", new Date("2006-02-03")),
        Episode.create(1, 1, 3, "Fifty-Fifty", new Date("2006-02-10")),
        Episode.create(1, 1, 4, "The Red Door", new Date("2006-02-17")),
        Episode.create(1, 1, 5, "The Haunting of Bill Crouse", new Date("2006-02-24")),
        Episode.create(1, 1, 6, "Aunt Irma Visits", new Date("2006-03-03")),
        Episode.create(1, 2, 1, "The Work Outing", new Date("2006-08-24")),
        Episode.create(1, 2, 2, "Return of the Golden Child", new Date("2007-08-31")),
        Episode.create(1, 2, 3, "Moss and the German", new Date("2007-09-07")),
        Episode.create(1, 2, 4, "The Dinner Party", new Date("2007-09-14")),
        Episode.create(1, 2, 5, "Smoke and Mirrors", new Date("2007-09-21")),
        Episode.create(1, 2, 6, "Men Without Women", new Date("2007-09-28")),
        Episode.create(1, 3, 1, "From Hell", new Date("2008-11-21")),
        Episode.create(1, 3, 2, "Are We Not Men?", new Date("2008-11-28")),
        Episode.create(1, 3, 3, "Tramps Like Us", new Date("2008-12-05")),
        Episode.create(1, 3, 4, "The Speech", new Date("2008-12-12")),
        Episode.create(1, 3, 5, "Friendface", new Date("2008-12-19")),
        Episode.create(1, 3, 6, "Calendar Geeks", new Date("2008-12-26")),
        Episode.create(1, 4, 1, "Jen The Fredo", new Date("2010-06-25")),
        Episode.create(1, 4, 2, "The Final Countdown", new Date("2010-07-02")),
        Episode.create(1, 4, 3, "Something Happened", new Date("2010-07-09")),
        Episode.create(1, 4, 4, "Italian For Beginners", new Date("2010-07-16")),
        Episode.create(1, 4, 5, "Bad Boys", new Date("2010-07-23")),
        Episode.create(1, 4, 6, "Reynholm vs Reynholm", new Date("2010-07-30")),
        Episode.create(2, 1, 1, "Minimum Viable Product", new Date("2014-04-06")),
        Episode.create(2, 1, 2, "The Cap Table", new Date("2014-04-13")),
        Episode.create(2, 1, 3, "Articles of Incorporation", new Date("2014-04-20")),
        Episode.create(2, 1, 4, "Fiduciary Duties", new Date("2014-04-27")),
        Episode.create(2, 1, 5, "Signaling Risk", new Date("2014-05-04")),
        Episode.create(2, 1, 6, "Third Party Insourcing", new Date("2014-05-11")),
        Episode.create(2, 1, 7, "Proof of Concept", new Date("2014-05-18")),
        Episode.create(2, 1, 8, "Optimal Tip-to-Tip Efficiency", new Date("2014-06-01")),
        Episode.create(2, 2, 1, "Sand Hill Shuffle", new Date("2015-04-12")),
        Episode.create(2, 2, 2, "Runaway Devaluation", new Date("2015-04-19")),
        Episode.create(2, 2, 3, "Bad Money", new Date("2015-04-26")),
        Episode.create(2, 2, 4, "The Lady", new Date("2015-05-03")),
        Episode.create(2, 2, 5, "Server Space", new Date("2015-05-10")),
        Episode.create(2, 2, 6, "Homicide", new Date("2015-05-17")),
        Episode.create(2, 2, 7, "Adult Content", new Date("2015-05-24")),
        Episode.create(2, 2, 8, "White Hat/Black Hat", new Date("2015-05-31")),
        Episode.create(2, 2, 9, "Binding Arbitration", new Date("2015-06-07")),
        Episode.create(2, 2, 1, "Two Days of the Condor", new Date("2015-06-14")),
        Episode.create(2, 3, 1, "Founder Friendly", new Date("2016-04-24")),
        Episode.create(2, 3, 2, "Two in the Box", new Date("2016-05-01")),
        Episode.create(2, 3, 3, "Meinertzhagen's Haversack", new Date("2016-05-08")),
        Episode.create(2, 3, 4, "Maleant Data Systems Solutions", new Date("2016-05-15")),
        Episode.create(2, 3, 5, "The Empty Chair", new Date("2016-05-22")),
        Episode.create(2, 3, 6, "Bachmanity Insanity", new Date("2016-05-29")),
        Episode.create(2, 3, 7, "To Build a Better Beta", new Date("2016-06-05")),
        Episode.create(2, 3, 8, "Bachman's Earnings Over-Ride", new Date("2016-06-12")),
        Episode.create(2, 3, 9, "Daily Active Users", new Date("2016-06-19")),
        Episode.create(2, 3, 1, "The Uptick", new Date("2016-06-26")),
        Episode.create(2, 4, 1, "Success Failure", new Date("2017-04-23")),
        Episode.create(2, 4, 2, "Terms of Service", new Date("2017-04-30")),
        Episode.create(2, 4, 3, "Intellectual Property", new Date("2017-05-07")),
        Episode.create(2, 4, 4, "Teambuilding Exercise", new Date("2017-05-14")),
        Episode.create(2, 4, 5, "The Blood Boy", new Date("2017-05-21")),
        Episode.create(2, 4, 6, "Customer Service", new Date("2017-05-28")),
        Episode.create(2, 4, 7, "The Patent Troll", new Date("2017-06-04")),
        Episode.create(2, 4, 8, "The Keenan Vortex", new Date("2017-06-11")),
        Episode.create(2, 4, 9, "Hooli-Con", new Date("2017-06-18")),
        Episode.create(2, 4, 1, "Server Error", new Date("2017-06-25")),
        Episode.create(2, 5, 1, "Grow Fast or Die Slow", new Date("2018-03-25")),
        Episode.create(2, 5, 2, "Reorientation", new Date("2018-04-01")),
        Episode.create(2, 5, 3, "Chief Operating Officer", new Date("2018-04-08")),
        Episode.create(2, 5, 4, "Tech Evangelist", new Date("2018-04-15")),
        Episode.create(2, 5, 5, "Facial Recognition", new Date("2018-04-22")),
        Episode.create(2, 5, 6, "Artificial Emotional Intelligence", new Date("2018-04-29")),
        Episode.create(2, 5, 7, "Initial Coin Offering", new Date("2018-05-06")),
        Episode.create  (2, 5, 8, "Fifty-One Percent", new Date("2018-05-13")),
    ]);
}
