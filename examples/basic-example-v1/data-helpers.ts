// const moment = require('moment');
import {DateTime} from "luxon";
import {declareType, TypedData} from "../../src/types";
import {Ydb} from "../../proto/bundle";

import Type = Ydb.Type;


const UNIX_ZERO = DateTime.fromISO('1970-01-01');
function toDays(date: string): number {
    return Math.ceil(DateTime.fromISO(date).diff(UNIX_ZERO).as('days'));
}

interface ISeries {
    seriesId: number,
    title: string,
    releaseDate: string,
    seriesInfo: string
}
export class Series extends TypedData {
    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seriesId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public title: string;

    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public releaseDate: number;

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public seriesInfo: string;

    static create(seriesId: number, title: string, releaseDate: string, seriesInfo: string): Series {
        return new this({seriesId, title, releaseDate, seriesInfo});
    }

    constructor(data: ISeries) {
        super(data);
        this.seriesId = data.seriesId;
        this.title = data.title;
        this.releaseDate = toDays(data.releaseDate);
        this.seriesInfo = data.seriesInfo;
    }
}

interface IEpisode {
    seriesId: number,
    seasonId: number,
    episodeId: number,
    title: string,
    airDate: string
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
    public airDate: number;

    static create(seriesId: number, seasonId: number, episodeId: number, title: string, airDate: string): Episode {
        return new this({seriesId, seasonId, episodeId, title, airDate});
    }

    constructor(data: IEpisode) {
        super(data);
        this.seriesId = data.seriesId;
        this.seasonId = data.seasonId;
        this.episodeId = data.episodeId;
        this.title = data.title;
        this.airDate = toDays(data.airDate);
    }
}

interface ISeason {
    seriesId: number,
    seasonId: number,
    title: string,
    firstAired: string,
    lastAired: string
}
export class Season extends TypedData {
    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seriesId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UINT64})
    public seasonId: number;

    @declareType({typeId: Type.PrimitiveTypeId.UTF8})
    public title: string;

    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public firstAired: number;

    @declareType({typeId: Type.PrimitiveTypeId.DATE})
    public lastAired: number;

    static create(seriesId: number, seasonId: number, title: string, firstAired: string, lastAired: string): Season {
        return new this({seriesId, seasonId, title, firstAired, lastAired});
    }

    constructor(data: ISeason) {
        super(data);
        this.seriesId = data.seriesId;
        this.seasonId = data.seasonId;
        this.title = data.title;
        this.firstAired = toDays(data.firstAired);
        this.lastAired = toDays(data.lastAired);
    }
}

export function getSeriesData() {
    return Series.asTypedCollection([
        Series.create(1, "IT Crowd", "2006-02-03",
            "The IT Crowd is a British sitcom produced by Channel 4, written by Graham Linehan, produced by " +
            "Ash Atalla and starring Chris O'Dowd, Richard Ayoade, Katherine Parkinson, and Matt Berry."),
        Series.create(2, "Silicon Valley",  "2014-04-06",
            "Silicon Valley is an American comedy television series created by Mike Judge, John Altschuler and " +
            "Dave Krinsky. The series focuses on five young men who founded a startup company in Silicon Valley.")
    ]);
}

export function getSeasonsData() {
    return Season.asTypedCollection([
        Season.create(1, 1, "Season 1", "2006-02-03", "2006-03-03"),
        Season.create(1, 2, "Season 2", "2007-08-24", "2007-09-28"),
        Season.create(1, 3, "Season 3", "2008-11-21", "2008-12-26"),
        Season.create(1, 4, "Season 4", "2010-06-25", "2010-07-30"),
        Season.create(2, 1, "Season 1", "2014-04-06", "2014-06-01"),
        Season.create(2, 2, "Season 2", "2015-04-12", "2015-06-14"),
        Season.create(2, 3, "Season 3", "2016-04-24", "2016-06-26"),
        Season.create(2, 4, "Season 4", "2017-04-23", "2017-06-25"),
        Season.create(2, 5, "Season 5", "2018-03-25", "2018-05-13")
    ]);
}

export function getEpisodesData() {
    return Episode.asTypedCollection([
        Episode.create(1, 1, 1, "Yesterday's Jam", "2006-02-03"),
        Episode.create(1, 1, 2, "Calamity Jen", "2006-02-03"),
        Episode.create(1, 1, 3, "Fifty-Fifty", "2006-02-10"),
        Episode.create(1, 1, 4, "The Red Door", "2006-02-17"),
        Episode.create(1, 1, 5, "The Haunting of Bill Crouse", "2006-02-24"),
        Episode.create(1, 1, 6, "Aunt Irma Visits", "2006-03-03"),
        Episode.create(1, 2, 1, "The Work Outing", "2006-08-24"),
        Episode.create(1, 2, 2, "Return of the Golden Child", "2007-08-31"),
        Episode.create(1, 2, 3, "Moss and the German", "2007-09-07"),
        Episode.create(1, 2, 4, "The Dinner Party", "2007-09-14"),
        Episode.create(1, 2, 5, "Smoke and Mirrors", "2007-09-21"),
        Episode.create(1, 2, 6, "Men Without Women", "2007-09-28"),
        Episode.create(1, 3, 1, "From Hell", "2008-11-21"),
        Episode.create(1, 3, 2, "Are We Not Men?", "2008-11-28"),
        Episode.create(1, 3, 3, "Tramps Like Us", "2008-12-05"),
        Episode.create(1, 3, 4, "The Speech", "2008-12-12"),
        Episode.create(1, 3, 5, "Friendface", "2008-12-19"),
        Episode.create(1, 3, 6, "Calendar Geeks", "2008-12-26"),
        Episode.create(1, 4, 1, "Jen The Fredo", "2010-06-25"),
        Episode.create(1, 4, 2, "The Final Countdown", "2010-07-02"),
        Episode.create(1, 4, 3, "Something Happened", "2010-07-09"),
        Episode.create(1, 4, 4, "Italian For Beginners", "2010-07-16"),
        Episode.create(1, 4, 5, "Bad Boys", "2010-07-23"),
        Episode.create(1, 4, 6, "Reynholm vs Reynholm", "2010-07-30"),
        Episode.create(2, 1, 1, "Minimum Viable Product", "2014-04-06"),
        Episode.create(2, 1, 2, "The Cap Table", "2014-04-13"),
        Episode.create(2, 1, 3, "Articles of Incorporation", "2014-04-20"),
        Episode.create(2, 1, 4, "Fiduciary Duties", "2014-04-27"),
        Episode.create(2, 1, 5, "Signaling Risk", "2014-05-04"),
        Episode.create(2, 1, 6, "Third Party Insourcing", "2014-05-11"),
        Episode.create(2, 1, 7, "Proof of Concept", "2014-05-18"),
        Episode.create(2, 1, 8, "Optimal Tip-to-Tip Efficiency", "2014-06-01"),
        Episode.create(2, 2, 1, "Sand Hill Shuffle", "2015-04-12"),
        Episode.create(2, 2, 2, "Runaway Devaluation", "2015-04-19"),
        Episode.create(2, 2, 3, "Bad Money", "2015-04-26"),
        Episode.create(2, 2, 4, "The Lady", "2015-05-03"),
        Episode.create(2, 2, 5, "Server Space", "2015-05-10"),
        Episode.create(2, 2, 6, "Homicide", "2015-05-17"),
        Episode.create(2, 2, 7, "Adult Content", "2015-05-24"),
        Episode.create(2, 2, 8, "White Hat/Black Hat", "2015-05-31"),
        Episode.create(2, 2, 9, "Binding Arbitration", "2015-06-07"),
        Episode.create(2, 2, 1, "Two Days of the Condor", "2015-06-14"),
        Episode.create(2, 3, 1, "Founder Friendly", "2016-04-24"),
        Episode.create(2, 3, 2, "Two in the Box", "2016-05-01"),
        Episode.create(2, 3, 3, "Meinertzhagen's Haversack", "2016-05-08"),
        Episode.create(2, 3, 4, "Maleant Data Systems Solutions", "2016-05-15"),
        Episode.create(2, 3, 5, "The Empty Chair", "2016-05-22"),
        Episode.create(2, 3, 6, "Bachmanity Insanity", "2016-05-29"),
        Episode.create(2, 3, 7, "To Build a Better Beta", "2016-06-05"),
        Episode.create(2, 3, 8, "Bachman's Earnings Over-Ride", "2016-06-12"),
        Episode.create(2, 3, 9, "Daily Active Users", "2016-06-19"),
        Episode.create(2, 3, 1, "The Uptick", "2016-06-26"),
        Episode.create(2, 4, 1, "Success Failure", "2017-04-23"),
        Episode.create(2, 4, 2, "Terms of Service", "2017-04-30"),
        Episode.create(2, 4, 3, "Intellectual Property", "2017-05-07"),
        Episode.create(2, 4, 4, "Teambuilding Exercise", "2017-05-14"),
        Episode.create(2, 4, 5, "The Blood Boy", "2017-05-21"),
        Episode.create(2, 4, 6, "Customer Service", "2017-05-28"),
        Episode.create(2, 4, 7, "The Patent Troll", "2017-06-04"),
        Episode.create(2, 4, 8, "The Keenan Vortex", "2017-06-11"),
        Episode.create(2, 4, 9, "Hooli-Con", "2017-06-18"),
        Episode.create(2, 4, 1, "Server Error", "2017-06-25"),
        Episode.create(2, 5, 1, "Grow Fast or Die Slow", "2018-03-25"),
        Episode.create(2, 5, 2, "Reorientation", "2018-04-01"),
        Episode.create(2, 5, 3, "Chief Operating Officer", "2018-04-08"),
        Episode.create(2, 5, 4, "Tech Evangelist", "2018-04-15"),
        Episode.create(2, 5, 5, "Facial Recognition", "2018-04-22"),
        Episode.create(2, 5, 6, "Artificial Emotional Intelligence", "2018-04-29"),
        Episode.create(2, 5, 7, "Initial Coin Offering", "2018-05-06"),
        Episode.create  (2, 5, 8, "Fifty-One Percent", "2018-05-13"),
    ]);
}
