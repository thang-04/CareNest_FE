import { PERMISSION_FEATURES, PERMISSION_FLOWS, PERMISSION_GROUPS, PERMISSION_MODULE_LABELS } from '@/models/account/permissionConstants';

// Cột HT chỉ để đối chiếu: quyền HT cố định trong code BE, không có hàng trong ma trận (ADR-0017).
export const PERMISSION_MATRIX_ROLES = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];

export const permissionMatrixRows = (catalog = [], roles = []) =>
  catalog.map((permission) => {
    const cells = Object.fromEntries(
      PERMISSION_MATRIX_ROLES.map((role) => {
        const entry = roles.find((item) => item.role === role);
        return [
          role,
          {
            configurable:
              !!entry?.editable &&
              entry.configurablePermissions.includes(permission.code) &&
              (permission.configurableRoles || []).includes(role),
            checked: !!entry?.permissions.includes(permission.code),
            fixedRole: !entry?.editable,
          },
        ];
      }),
    );
    return { ...permission, cells };
  });

/**
 * Gom catalog theo `feature` BE trả: mỗi nghiệp vụ có mã xem (`action: VIEW`) và các mã còn lại.
 * Catalog thiếu `feature/action` ⇒ mỗi mã là một nghiệp vụ riêng.
 */
export const permissionFeatures = (catalog = []) => {
  const features = new Map();
  catalog.forEach((permission) => {
    const key = permission.feature || permission.code;
    if (!features.has(key)) features.set(key, { key, module: permission.module, viewCodes: [], manageCodes: [] });
    features.get(key)[permission.action === 'VIEW' ? 'viewCodes' : 'manageCodes'].push(permission.code);
  });
  return [...features.values()];
};

export const permissionFeatureLabel = (feature, catalog = []) =>
  PERMISSION_FEATURES[feature.key]?.label ||
  PERMISSION_GROUPS[feature.key]?.label ||
  catalog.find((permission) => permission.feature === feature.key)?.description ||
  feature.key;

/** Dòng bảng: mã xem đứng đầu nhóm, mã cần mã khác (`requires`) thụt vào dưới. */
export const permissionTableRows = (catalog = [], features = permissionFeatures(catalog)) =>
  features.map((feature) => ({
    feature,
    rows: [...feature.viewCodes, ...feature.manageCodes].map((code) => ({
      code,
      dependent: (catalog.find((permission) => permission.code === code)?.requires || []).length > 0,
    })),
  }));

const flowKeyOf = (feature) => PERMISSION_FEATURES[feature.key]?.flow || feature.module || feature.key;

export const permissionFlowLabel = (key) => PERMISSION_FLOWS[key]?.label || PERMISSION_MODULE_LABELS[key] || key;

/** Gom các nhóm dòng (cấp 2) vào luồng lớn (cấp 1), giữ thứ tự xuất hiện. `codes` = mọi mã trong luồng. */
export const groupByFlow = (groups = []) => {
  const flows = new Map();
  groups.forEach((group) => {
    const key = flowKeyOf(group.feature);
    if (!flows.has(key)) flows.set(key, { key, label: permissionFlowLabel(key), groups: [], codes: [] });
    const flow = flows.get(key);
    flow.groups.push(group);
    flow.codes.push(...group.rows.map((row) => row.code));
  });
  return [...flows.values()];
};

/** Trạng thái ô tick của cả luồng, chỉ tính mã chỉnh được: all | some | none; không có mã chỉnh được ⇒ null. */
export const flowCheckState = (flowCodes, checkedCodes, isConfigurable) => {
  const editable = flowCodes.filter(isConfigurable);
  if (!editable.length) return null;
  const on = editable.filter((code) => checkedCodes.includes(code)).length;
  if (on === 0) return 'none';
  return on === editable.length ? 'all' : 'some';
};

/** Đếm số việc đang có trong luồng để hiện "3/5 việc" khi luồng thu gọn; chỉ đếm, không suy luận quyền. */
export const flowCount = (flowCodes, checkedCodes) => ({
  on: flowCodes.filter((code) => checkedCodes.includes(code)).length,
  total: flowCodes.length,
});

/**
 * Tick/bỏ tick cả luồng: đi từng mã chỉnh được qua `toggleWithRequires` nên quan hệ cần-có của catalog BE vẫn đúng
 * (kể cả mã ngoài luồng cần mã trong luồng). Trả `{ codes, added, removed }` so với `codes` ban đầu.
 */
export const toggleFlow = (catalog, codes, flowCodes, on, isConfigurable) => {
  const next = flowCodes
    .filter(isConfigurable)
    .reduce((acc, code) => toggleWithRequires(catalog, acc, code, on, isConfigurable).codes, codes);
  return { codes: next, ...codeDiff(codes, next) };
};

/** Mã role được bật/tắt: role cấu hình được và mã nằm trong `configurablePermissions` BE trả. */
export const configurableCheck = (entry) => (code) => !!entry?.editable && !!entry.configurablePermissions?.includes(code);

const requiresOf = (catalog, code) => catalog.find((permission) => permission.code === code)?.requires || [];

/**
 * Tick/bỏ tick một việc. Quan hệ cần-có lấy từ `requires` của catalog BE, FE không tự đặt (AGENTS.md nguyên tắc 2):
 * tick ⇒ tự tick mã cần có; bỏ tick ⇒ tự bỏ các mã đang cần nó. Trả về `{ codes, added, removed }` (mã tự đổi kèm theo).
 */
export const toggleWithRequires = (catalog, codes, code, on, isConfigurable) => {
  const next = new Set(codes);
  const added = [];
  const removed = [];
  if (on) {
    next.add(code);
    const pending = [code];
    while (pending.length) {
      requiresOf(catalog, pending.pop()).forEach((required) => {
        if (isConfigurable(required) && !next.has(required)) {
          next.add(required);
          added.push(required);
          pending.push(required);
        }
      });
    }
  } else {
    next.delete(code);
    const pending = [code];
    while (pending.length) {
      const gone = pending.pop();
      [...next].forEach((other) => {
        if (isConfigurable(other) && requiresOf(catalog, other).includes(gone)) {
          next.delete(other);
          removed.push(other);
          pending.push(other);
        }
      });
    }
  }
  return { codes: [...next].sort(), added, removed };
};

/** Mã thêm/bớt giữa hai tập (câu xác nhận, ngoại lệ so với vai trò). */
export const codeDiff = (before = [], after = []) => ({
  added: after.filter((code) => !before.includes(code)),
  removed: before.filter((code) => !after.includes(code)),
});

/** Gom dòng lịch sử cùng lần lưu (`batchId`), cùng đối tượng và cùng nghiệp vụ; giữ thứ tự mới nhất trước. */
export const groupChangeLogs = (logs = [], catalog = []) => {
  const featureOf = (code) => catalog.find((permission) => permission.code === code)?.feature || code;
  const groups = [];
  logs.forEach((log) => {
    const key = [log.batchId || log.id, log.targetRole || '', log.targetUserId || '', featureOf(log.permissionCode)].join('|');
    const group = groups.find((item) => item.key === key);
    if (group) group.logs.push(log);
    else groups.push({ key, feature: featureOf(log.permissionCode), logs: [log] });
  });
  return groups;
};
