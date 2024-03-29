import { Podcast, Primitive } from '../../../../client/interfaces';

export interface SharedKeywords {
  name: string;
  count: number;
}

export const findSharedCategoriesAndKeywords = (podcast1: Podcast, podcast2: Podcast) => {
  const keywordsAndCategories1 = [...(podcast1.keywords || []), ...(podcast1.categories || [])];
  const keywordsAndCategories2 = [...(podcast2.keywords || []), ...(podcast2.categories || [])];
  const arr = [...keywordsAndCategories1.filter(x => keywordsAndCategories2.includes(x))];
  return removeDuplicateElements(arr);
};

export const haveSharedElements = <T extends Primitive>(arr1: T[] = [],
  arr2: T[] = []) => arr1.some(item => arr2.includes(item));

export const haveSharedKeywords = (
  currentKeywords: SharedKeywords[],
  keywords: string[],
) => keywords.some(keyword => currentKeywords.some(item => item.name === keyword));

/**
 * @param array
 * @returns The given `array`, omitting duplicate as well as falsy elements
 */
export const removeDuplicateElements = <T extends Primitive>(array: T[]) => [
  ...new Set(array.filter(x => x)),
];
