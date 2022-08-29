import { Primitive } from '../interfaces';
import { sanitizeString } from './sanitization';

export function valueToLowerCase(value: any) : string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/**
 * @param list1
 * @param list2
 * @returns The given arrays, concatenated, mapped to lower case & sanitized,
 *   omitting any duplicate/empty strings and non-string elements.
 *   - rss-parser patch: if either param is a (comma-separated) string, it's converted to an Array.
 */
export function mergeArraysToLowerCase<T extends Primitive>(
  list1 : T[] | string = [],
  list2 : T[] | string = [],
) : string[] {
  const filterArray = (arr: T[]) : string[] => arr
    .map(x => sanitizeString(valueToLowerCase(x), false))
    .filter(x => x);

  /** Sometimes rss-parser returns a comma-separated string instead of an Array */
  const convertToArray = (param: any) : any[] => {
    if (typeof param === 'string') return param.split(/[,;]+/);
    if (!Array.isArray(param)) return [];
    return param;
  };

  const concat = filterArray(convertToArray(list1)).concat(filterArray(convertToArray(list2)));
  return [...new Set(concat)];
}

export function truncateString(str: string, length: number = 0, ellipses = '...') : string {
  if (!str || !length || str.length <= length) return str;

  return `${str.substring(0, length - ellipses.length)}${ellipses}`;
}
