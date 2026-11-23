import { isDemoModule, sourceOf } from '@/services/demoSource';
import { kitchenMockRepository } from '@/services/kitchen/mock/kitchenMockRepository';
import { nutritionCatalogApi } from '@/services/nutritionCatalogApi';
import { canManageSuppliers } from '@/utils/kitchen/kitchenPermissions';
import { hasBePermission } from '@/utils/bePermissions';
import { PERMISSIONS } from '@/models/bePermissions';

// Danh mục nhà cung cấp dùng chung cho thực phẩm và bếp, cùng nguồn nutrition-catalog.
const supplierRepo = sourceOf('nutrition-catalog', kitchenMockRepository, nutritionCatalogApi);

export const suppliersUseApi = () => !isDemoModule('nutrition-catalog');
export const canEditSuppliers = (user) =>
  suppliersUseApi() ? hasBePermission(user, PERMISSIONS.NUTRITION_MANAGE) : canManageSuppliers(user);
export const getSuppliers = (filters, user) => supplierRepo.getSuppliers(filters, user);
export const getSupplier = (filters, user) => supplierRepo.getSupplier(filters, user);
export const saveSupplier = (payload, user) => supplierRepo.saveSupplier(payload, user);
export const deleteSupplier = (payload, user) => supplierRepo.deleteSupplier(payload, user);
// Hợp đồng NCC và chuyển giá hàng loạt (NUT-27) chỉ có ở BE thật.
export const getSupplierFoods = (supplierId, date) => nutritionCatalogApi.getSupplierFoods(supplierId, date);
export const applySupplierContract = (supplierId, payload) => nutritionCatalogApi.applySupplierContract(supplierId, payload);
