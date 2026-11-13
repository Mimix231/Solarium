import { warehouseCategories } from '../../catalog/categories';
import type { SpicaBlockMetadata } from './contracts';
import { generatedSpicaCategoryFolders } from './registry.generated';

/** Category IDs are those already published by the 35-category catalog. */
export const spicaBlockCategories = warehouseCategories;
export const spicaCategoryFolders: Readonly<Record<string, number>> = generatedSpicaCategoryFolders;

export function blockCategoryValid(definition: Pick<SpicaBlockMetadata, 'categoryId' | 'sourcePath'>): boolean {
  const relative = definition.sourcePath.replace(/^src\/spica\/runtime\/blocks\//, '');
  const folder = relative.split('/')[0];
  return Number.isInteger(definition.categoryId) &&
    spicaCategoryFolders[folder ?? ''] === definition.categoryId &&
    spicaBlockCategories.some(category => category.id === definition.categoryId);
}
