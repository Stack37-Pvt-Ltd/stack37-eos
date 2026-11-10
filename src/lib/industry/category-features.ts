/** Feature visibility for the platform's existing business categories. */
export function supportsRetailOperations(categoryName: string | null | undefined): boolean {
  return categoryName?.trim().toLocaleLowerCase() === 'retail & e-commerce';
}