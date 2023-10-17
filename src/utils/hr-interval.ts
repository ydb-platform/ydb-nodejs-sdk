/**
 * Formats time interval in human-readable form in toString().
 */
export class HRInterval {
    constructor(readonly period: number) {}
    toString() {
        let remaining = Math.trunc(this.period / 1000);
        const hours = Math.trunc(remaining / 60 / 60);

        remaining -= hours * 60 * 60;
        const minutes = Math.trunc(remaining / 60);

        const seconds = remaining - minutes * 60;

        return `${hours.toString()
            .padStart(2, '0')}:${minutes.toString()
            .padStart(2, '0')}:${seconds.toString()
            .padStart(2, '0')}`;
    }
}
