package moment.unit {

    declare type Base = 
        "year" | "years" | "y" |
        "month" | "months" | "M" |
        "week" | "weeks" | "w" |
        "day" | "days" | "d" |
        "hour" | "hours" | "h" |
        "minute" | "minutes" | "m" |
        "second" | "seconds" | "s" |
        "millisecond" | "milliseconds" | "ms"
    ;

    declare type _quarter = "quarter" | "quarters" | "Q";
    declare type _isoWeek = "isoWeek" | "isoWeeks" | "W";
    declare type _date = "date" | "dates" | "D";
    declare type DurationConstructor = Base | _quarter;

    declare type DurationAs = Base;

    declare type StartOf = Base | _quarter | _isoWeek | _date | null;

    declare type Diff = Base | _quarter;

    declare type MomentConstructor = Base | _date;

    declare type All = Base | _quarter | _isoWeek | _date |
        "weekYear" | "weekYears" | "gg" |
        "isoWeekYear" | "isoWeekYears" | "GG" |
        "dayOfYear" | "dayOfYears" | "DDD" |
        "weekday" | "weekdays" | "e" |
        "isoWeekday" | "isoWeekdays" | "E";

}


package moment{

    declare type RelativeTimeKey = 's' | 'ss' | 'm' | 'mm' | 'h' | 'hh' | 'd' | 'dd' | 'w' | 'ww' | 'M' | 'MM' | 'y' | 'yy';
    declare type CalendarKey = 'sameDay' | 'nextDay' | 'lastDay' | 'nextWeek' | 'lastWeek' | 'sameElse' | string;
    declare type LongDateFormatKey = 'LTS' | 'LT' | 'L' | 'LL' | 'LLL' | 'LLLL' | 'lts' | 'lt' | 'l' | 'll' | 'lll' | 'llll';

    declare interface Locale {

        calendar(key?: CalendarKey, m?: Moment, now?: Moment): string;

        longDateFormat(key: LongDateFormatKey): string;
        invalidDate(): string;
        ordinal(n: number): string;

        preparse(inp: string): string;
        postformat(inp: string): string;
        relativeTime(n: number, withoutSuffix: boolean,
                        key: RelativeTimeKey, isFuture: boolean): string;
        pastFuture(diff: number, absRelTime: string): string;
        set(config: Object): void;

        months(m?: Moment, format?: string): string | string[];
        monthsShort(m?: Moment, format?: string): string | string[];
        monthsParse(monthName: string, format: string, strict: boolean): number;
        monthsRegex(strict: boolean): RegExp;
        monthsShortRegex(strict: boolean): RegExp;

        week(m: Moment): number;
        firstDayOfYear(): number;
        firstDayOfWeek(): number;

        weekdays(m?: Moment, format?: string): string | string[];
        weekdaysMin(m?: Moment): string | string[];
        weekdaysShort(m?: Moment): string | string[];
        weekdaysParse(weekdayName: string, format: string, strict: boolean): number;
        weekdaysRegex(strict: boolean): RegExp;
        weekdaysShortRegex(strict: boolean): RegExp;
        weekdaysMinRegex(strict: boolean): RegExp;

        isPM(input: string): boolean;
        meridiem(hour: number, minute: number, isLower: boolean): string;
    }

    declare interface StandaloneFormatSpec {
        format: string[];
        standalone: string[];
        isFormat?: RegExp;
    }

    declare interface WeekSpec {
        dow: number;
        doy?: number;
    }

    declare type CalendarSpecVal = string | ((m?: MomentInput, now?: Moment) => string);

    declare interface CalendarSpec {
        sameDay?: CalendarSpecVal;
        nextDay?: CalendarSpecVal;
        lastDay?: CalendarSpecVal;
        nextWeek?: CalendarSpecVal;
        lastWeek?: CalendarSpecVal;
        sameElse?: CalendarSpecVal;

        // any additional properties might be used with moment.calendarFormat
        [x: string]: CalendarSpecVal;
    }

    declare type RelativeTimeSpecVal = string | (n: number, withoutSuffix: boolean,key: RelativeTimeKey, isFuture: boolean) => string;
    declare type RelativeTimeFuturePastVal = string | ((relTime: string) => string);

    declare interface RelativeTimeSpec {
        future?: RelativeTimeFuturePastVal;
        past?: RelativeTimeFuturePastVal;
        s?: RelativeTimeSpecVal;
        ss?: RelativeTimeSpecVal;
        m?: RelativeTimeSpecVal;
        mm?: RelativeTimeSpecVal;
        h?: RelativeTimeSpecVal;
        hh?: RelativeTimeSpecVal;
        d?: RelativeTimeSpecVal;
        dd?: RelativeTimeSpecVal;
        w?: RelativeTimeSpecVal;
        ww?: RelativeTimeSpecVal;
        M?: RelativeTimeSpecVal;
        MM?: RelativeTimeSpecVal;
        y?: RelativeTimeSpecVal;
        yy?: RelativeTimeSpecVal;
    }

    declare interface LongDateFormatSpec {
        LTS: string;
        LT: string;
        L: string;
        LL: string;
        LLL: string;
        LLLL: string;

        // lets forget for a sec that any upper/lower permutation will also work
        lts?: string;
        lt?: string;
        l?: string;
        ll?: string;
        lll?: string;
        llll?: string;
    }

    declare type MonthWeekdayFn = (momentToFormat: Moment, format?: string) => string;
    declare type WeekdaySimpleFn = (momentToFormat: Moment) => string;

    declare interface LocaleSpecification {
        months?: string[] | StandaloneFormatSpec | MonthWeekdayFn;
        monthsShort?: string[] | StandaloneFormatSpec | MonthWeekdayFn;

        weekdays?: string[] | StandaloneFormatSpec | MonthWeekdayFn;
        weekdaysShort?: string[] | StandaloneFormatSpec | WeekdaySimpleFn;
        weekdaysMin?: string[] | StandaloneFormatSpec | WeekdaySimpleFn;

        meridiemParse?: RegExp;
        meridiem?: (hour: number, minute:number, isLower: boolean) => string;

        isPM?: (input: string) => boolean;

        longDateFormat?: LongDateFormatSpec;
        calendar?: CalendarSpec;
        relativeTime?: RelativeTimeSpec;
        invalidDate?: string;
        ordinal?: (n: number) => string;
        ordinalParse?: RegExp;

        week?: WeekSpec;

        // Allow anything: in general any property that is passed as locale spec is
        // put in the locale object so it can be used by locale functions
        [x: string]: any;
    }

    declare interface MomentObjectOutput {
        years: number;
        /* One digit */
        months: number;
        /* Day of the month */
        date: number;
        hours: number;
        minutes: number;
        seconds: number;
        milliseconds: number;
    }

    declare interface argThresholdOpts {
        ss?: number;
        s?: number;
        m?: number;
        h?: number;
        d?: number;
        w?: number | null;
        M?: number;
    }

    declare interface Duration {
        clone(): Duration;

        humanize(argWithSuffix?: boolean, argThresholds?: argThresholdOpts): string;

        abs(): Duration;

        as(units: moment.unit.Base): number;
        get(units: moment.unit.Base): number;

        milliseconds(): number;
        asMilliseconds(): number;

        seconds(): number;
        asSeconds(): number;

        minutes(): number;
        asMinutes(): number;

        hours(): number;
        asHours(): number;

        days(): number;
        asDays(): number;

        weeks(): number;
        asWeeks(): number;

        months(): number;
        asMonths(): number;

        years(): number;
        asYears(): number;

        add(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;
        subtract(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;

        locale(locale?: LocaleSpecifier): Duration | string;
        localeData(): Locale;

        toISOString(): string;
        toJSON(): string;

        isValid(): boolean;
    }

    declare interface MomentRelativeTime {
        future: any;
        past: any;
        s: any;
        ss: any;
        m: any;
        mm: any;
        h: any;
        hh: any;
        d: any;
        dd: any;
        M: any;
        MM: any;
        y: any;
        yy: any;
    }

    declare interface MomentLongDateFormat {
        L: string;
        LL: string;
        LLL: string;
        LLLL: string;
        LT: string;
        LTS: string;

        l?: string;
        ll?: string;
        lll?: string;
        llll?: string;
        lt?: string;
        lts?: string;
    }

    declare interface MomentParsingFlags {
        empty: boolean;
        unusedTokens: string[];
        unusedInput: string[];
        overflow: number;
        charsLeftOver: number;
        nullInput: boolean;
        invalidMonth: string | null;
        invalidFormat: boolean;
        userInvalidated: boolean;
        iso: boolean;
        parsedDateParts: any[];
        meridiem: string | null;
    }

    declare interface MomentParsingFlagsOpt {
        empty?: boolean;
        unusedTokens?: string[];
        unusedInput?: string[];
        overflow?: number;
        charsLeftOver?: number;
        nullInput?: boolean;
        invalidMonth?: string;
        invalidFormat?: boolean;
        userInvalidated?: boolean;
        iso?: boolean;
        parsedDateParts?: any[];
        meridiem?: string | null;
    }

    declare type MomentFormatSpecification = string | string[];

    declare interface MomentInputObject {
        years?: number;
        year?: number;
        y?: number;

        months?: number;
        month?: number;
        M?: number;

        days?: number;
        day?: number;
        d?: number;

        dates?: number;
        date?: number;
        D?: number;

        hours?: number;
        hour?: number;
        h?: number;

        minutes?: number;
        minute?: number;
        m?: number;

        seconds?: number;
        second?: number;
        s?: number;

        milliseconds?: number;
        millisecond?: number;
        ms?: number;
    }

    declare interface DurationInputObject extends MomentInputObject {
        quarters?: number;
        quarter?: number;
        Q?: number;
        weeks?: number;
        week?: number;
        w?: number;
    }

    declare interface MomentSetObject extends MomentInputObject {
        weekYears?: number;
        weekYear?: number;
        gg?: number;

        isoWeekYears?: number;
        isoWeekYear?: number;
        GG?: number;

        quarters?: number;
        quarter?: number;
        Q?: number;

        weeks?: number;
        week?: number;
        w?: number;

        isoWeeks?: number;
        isoWeek?: number;
        W?: number;

        dayOfYears?: number;
        dayOfYear?: number;
        DDD?: number;

        weekdays?: number;
        weekday?: number;
        e?: number;

        isoWeekdays?: number;
        isoWeekday?: number;
        E?: number;
    }

    declare interface FromTo {
        from: MomentInput;
        to: MomentInput;
    }

    declare type MomentInput = Moment | Date | string | number | (number | string)[] | MomentInputObject | null;
    declare type DurationInputArg1 = Duration | number | string | FromTo | DurationInputObject | null;
    declare type DurationInputArg2 = moment.unit.DurationConstructor;
    declare type LocaleSpecifier = string | Moment | Duration | string[] | boolean;

    declare interface MomentCreationData {
        input: MomentInput;
        format?: MomentFormatSpecification;
        locale: Locale;
        isUTC: boolean;
        strict?: boolean;
    }

    /**
    * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
    * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
    * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
    */
    declare function utc(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

    declare function unix(timestamp: number): Moment;

    declare function invalid(flags?: MomentParsingFlagsOpt): Moment;
    declare function isMoment(m: any): boolean;
    declare function isDate(m: any): boolean;
    declare function isDuration(d: any): boolean;

    declare function locale(language?: string, definition?: LocaleSpecification | null): string;

    declare function localeData(key?: string | string[]): Locale;

    declare function duration(inp?: DurationInputArg1, unit?: DurationInputArg2): Duration;

    // NOTE(constructor): Same as moment constructor
    declare function parseZone(inp?: MomentInput, format?: MomentFormatSpecification, language?: string, strict?: boolean): Moment;

    declare function months(format: string, index?: number): string | string[];
    declare function monthsShort(format?: string | number, index?: number): string | string[];
    declare function weekdays(localeSorted?: boolean | number | string, format?: string, index?: number): string | string[];
    declare function weekdaysShort(localeSorted?: boolean | number | string, format?: string, index?: number): string | string[];
    declare function weekdaysMin(localeSorted?: boolean | number | string, format?: string, index?: number): string | string[];

    declare function min(...moments: (Moment | Moment[])[]): Moment;
    declare function max(...moments:(Moment | Moment[])[]): Moment;

    /**
    * Returns unix time in milliseconds. Overwrite for profit.
    */
    declare function now(): number;

    declare function defineLocale(language: string, localeSpec: LocaleSpecification | null): Locale;
    declare function updateLocale(language: string, localeSpec: LocaleSpecification | null): Locale;
    declare function locales(): string[];
    declare function normalizeUnits(unit: moment.unit.All): string;
    declare function relativeTimeThreshold(threshold: string, limit?: number): number | boolean;
    declare function relativeTimeRounding(fn?: (num: number) => number): boolean | ((num: number) => number);
    declare function calendarFormat(m: Moment, now: Moment): string;
    declare function parseTwoDigitYear(input: string): number;

    declare interface Moment {
        format(format?: string): string;

        startOf(unit: moment.unit.StartOf): Moment;
        endOf(unit: moment.unit.StartOf): Moment;

        add(amount?: DurationInputArg1, unit?: DurationInputArg2): Moment;


        subtract(amount?: DurationInputArg1, unit?: DurationInputArg2): Moment;

        calendar(time?: MomentInput, formats?: CalendarSpec): string;

        clone(): Moment;

        /**
        * @return Unix timestamp in milliseconds
        */
        valueOf(): number;

        // current date/time in local mode
        local(keepLocalTime?: boolean): Moment;
        isLocal(): boolean;

        // current date/time in UTC mode
        utc(keepLocalTime?: boolean): Moment;
        isUTC(): boolean;
        /**
        * @deprecated use isUTC
        */
        isUtc(): boolean;

        parseZone(): Moment;
        isValid(): boolean;
        invalidAt(): number;

        hasAlignedHourOffset(other?: MomentInput): boolean;

        creationData(): MomentCreationData;
        parsingFlags(): MomentParsingFlags;

        year(y?: number): number | Moment;
        quarter(q?: number):number | Moment;
        month(M?: number|string): number | Moment;
        day(d?: number|string): number | Moment;
        date(d?: number): number | Moment;
        hour(h?: number): number | Moment;
        minute(m?: number): number | Moment;
        second(s?: number): number | Moment;
        millisecond(ms?: number): number | Moment;
        weekday(d?: number): number | Moment;
        isoWeekday(d?: number|string): number | Moment;
        weekYear(d?: number): number | Moment;
        isoWeekYear(d?: number): number | Moment;
        week(d?: number): number | Moment;
        isoWeek(d?: number): number | Moment;
        weeksInYear(): number;
        isoWeeksInYear(): number;
        isoWeeksInISOWeekYear(): number;
        dayOfYear(d?: number): number | Moment;

        from(inp: MomentInput, suffix?: boolean): string;
        to(inp: MomentInput, suffix?: boolean): string;
        fromNow(withoutSuffix?: boolean): string;
        toNow(withoutPrefix?: boolean): string;
        diff(b: MomentInput, unit?: moment.unit.Diff, precise?: boolean): number;
        toArray(): [number, number, number, number, number, number, number];
        toDate(): Date;
        toISOString(keepOffset?: boolean): string;
        inspect(): string;
        toJSON(): string;
        unix(): number;
        isLeapYear(): boolean;
        zone(b: number|string): Moment;
        utcOffset(b?: number|string, keepLocalTime?: boolean): Moment;
        isUtcOffset(): boolean;
        daysInMonth(): number;
        isDST(): boolean;
        zoneAbbr(): string;
        zoneName(): string;
        isBefore(inp?: MomentInput, granularity?: moment.unit.StartOf): boolean;
        isAfter(inp?: MomentInput, granularity?: moment.unit.StartOf): boolean;
        isSame(inp?: MomentInput, granularity?: moment.unit.StartOf): boolean;
        isSameOrAfter(inp?: MomentInput, granularity?: moment.unit.StartOf): boolean;
        isSameOrBefore(inp?: MomentInput, granularity?: moment.unit.StartOf): boolean;
        isBetween(a: MomentInput, b: MomentInput, granularity?: moment.unit.StartOf, inclusivity?: "()" | "[)" | "(]" | "[]"): boolean;
        locale(locale?: LocaleSpecifier): string | Moment;
        localeData(): Locale;
        get(unit: moment.unit.All): number;
        set(unit: moment.unit.All | MomentSetObject, value: number): Moment;
        toObject(): MomentObjectOutput;
    }
}

import moment from 'moment';

/**
 * @param strict Strict parsing requires that the format and input match exactly, including delimiters.
 * Strict parsing is frequently the best parsing option. For more information about choosing strict vs
 * forgiving parsing, see the [parsing guide](https://momentjs.com/guides/#/parsing/).
 */
 declare function moment(inp?: moment.MomentInput, format?: moment.MomentFormatSpecification, language?: string, strict?: boolean): moment.Moment;