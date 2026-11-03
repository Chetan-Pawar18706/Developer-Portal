import { Pipe, type PipeTransform } from '@angular/core';

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

@Pipe({
  name: 'timeAgo',
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();

    if (Number.isNaN(timestamp)) {
      return '';
    }

    const seconds = Math.round((Date.now() - timestamp) / 1000);
    const future = seconds < 0;
    const absolute = Math.abs(seconds);

    const format = (amount: number, unit: Intl.RelativeTimeFormatUnit): string => {
      const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      return formatter.format(future ? amount : -amount, unit);
    };

    if (absolute < 45) {
      return 'just now';
    }

    if (absolute < 90) {
      return format(1, 'minute');
    }

    if (absolute < 45 * MINUTE) {
      return format(Math.round(absolute / MINUTE), 'minute');
    }

    if (absolute < 90 * MINUTE) {
      return format(1, 'hour');
    }

    if (absolute < 22 * HOUR) {
      return format(Math.round(absolute / HOUR), 'hour');
    }

    if (absolute < 36 * HOUR) {
      return format(1, 'day');
    }

    if (absolute < 26 * DAY) {
      return format(Math.round(absolute / DAY), 'day');
    }

    if (absolute < 45 * DAY) {
      return format(1, 'month');
    }

    if (absolute < 320 * DAY) {
      return format(Math.round(absolute / (30 * DAY)), 'month');
    }

    if (absolute < 548 * DAY) {
      return format(1, 'year');
    }

    return format(Math.round(absolute / (365 * DAY)), 'year');
  }
}
