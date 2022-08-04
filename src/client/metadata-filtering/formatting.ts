import { Primitive } from '../interfaces';
import { sanitizeString } from './sanitization';

export function valueToLowerCase(value: any) : string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/**
 * @param arr1
 * @param arr2
 * @returns {Array.<string>} The given arrays, concatenated, mapped to lower case & sanitized,
 *   omitting any duplicate/empty strings and non-string elements
 */
export function mergeArraysToLowerCase<T extends Primitive>(arr1 : T[] = [], arr2 : T[] = []) :
string[] {
  const filterArray = (arr : T[]) => (arr || [])
    .map(x => sanitizeString(valueToLowerCase(x), false))
    .filter(x => x);

  return [...new Set(filterArray(arr1).concat(filterArray(arr2)))];
}
