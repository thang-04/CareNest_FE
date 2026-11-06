import { beClient } from '@/services/http/beClient';
import { DB_CHANGED_EVENT } from '@/mocks/dbEvents';
import { MEAL_SESSION_LABELS, MICRONUTRIENTS, defaultStorageOf } from '@/models/menu-planning/menuPlanningConstants';
import { purchaseUnitSizeOf } from '@/utils/menu-planning/foodUnits';
import { normalizeText } from '@/utils/format';

/*
 * Danh mục bán trú (thực phẩm, món, nhà cung cấp, cấu hình nhóm tuổi) trên BE `/nutrition/*`. Giữ đúng tên hàm, tham số và dạng dữ liệu
 * của mock (menuPlanningMockRepository, kitchenMockRepository) để các màn không phải đổi. Đổi dạng:
 * - Thực phẩm: group ↔ foodGroup, nutrition{} ↔ kcal/protein/lipid/glucid, tên chất dị ứng ↔ allergenIds,
 *   origin 'ANIMAL'|'PLANT' giữ nguyên (BE bắt buộc; thiếu ⇒ '' để màn báo chưa đủ dữ liệu).
 *   BE chỉ có đơn vị mua ⇒ đơn vị kho = đơn vị mua, tỷ lệ 1. "Hay dùng" chỉ lưu ở trình duyệt.
 * - Món: portions {'ag-2': g} ↔ dòng định lượng theo ageGroupId của BE (code nhóm tuổi = id nhóm tuổi FE).
 *   BE không có Nháp ⇒ Nháp gửi thành Ngừng sử dụng.
 * - Xóa = chuyển Ngừng sử dụng (danh mục BE không xóa cứng).
 */
const FAVORITES_KEY = 'carenest:food-favorites';
const INACTIVE = 'INACTIVE';
const ACTIVE = 'ACTIVE';
const DRAFT = 'DRAFT';

const blank = (v) => v === '' || v == null;
const numOrNull = (v) => (blank(v) ? null : Number(v));
const text = (v) => (blank(v) ? '' : String(v).trim());
const sameName = (a, b) => normalizeText(String(a || '')).trim() === normalizeText(String(b || '')).trim();
const params = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));

// Tên trường lỗi validation của BE → ô trên form FE
const FOOD_FIELDS = { foodGroup: 'group', allergenIds: 'allergens', purchaseUnitSize: 'purchaseToStock' };
const DISH_FIELDS = { dishType: 'type' };
const SUPPLIER_FIELDS = { deliveryPerson: 'contactName' };
// Khóa định mức FE {key: [min, max]} ↔ gốc tên trường BE `${stem}Min`, `${stem}Max`
export const NORM_STEMS = {
  kcal: 'kcal',
  protein: 'proteinPct',
  lipid: 'lipidPct',
  glucid: 'glucidPct',
  animalProteinG: 'animalProteinG',
  plantProteinG: 'plantProteinG',
  animalLipidG: 'animalLipidG',
  plantLipidG: 'plantLipidG',
  glucidG: 'glucidG',
  morningKcalPct: 'morningKcalPct',
  lunchKcalPct: 'lunchKcalPct',
  afternoonKcalPct: 'afternoonKcalPct',
  // Vi chất (BE NUT-26): tên trường BE trùng khóa FE (calciumMin, vitaminAMax…)
  ...Object.fromEntries(MICRONUTRIENTS.map((k) => [k, k])),
};
const configFieldOf = (key) => {
  if (key === 'mealPrice') return 'price';
  if (key === 'dailyKcalNeed') return 'dailyKcalNeed';
  const norm = Object.entries(NORM_STEMS).find(([, stem]) => key === `${stem}Min` || key === `${stem}Max`);
  return norm ? `norms.${norm[0]}` : null;
};
const remapError = (error, fields, prefix = '') => {
  if (error?.details) {
    error.details = Object.fromEntries(
      Object.entries(error.details).map(([key, msg]) => {
        const base = key.replace(/\[.*$/, '').replace(/\..*$/, '');
        const field = key === '_form' ? key : fields[base] || base;
        return [prefix && field !== '_form' ? `${prefix}.${field}` : field, msg];
      }),
    );
  }
  return error;
};
const withFields = (fields) => async (run) => {
  try {
    return await run();
  } catch (error) {
    throw remapError(error, fields);
  }
};

const notifyChanged = () => {
  // Các màn đang mở (danh sách, chi tiết) nạp lại như khi dùng mock
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent(DB_CHANGED_EVENT));
};

const defaultStorage = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

/** Factory để test thay client HTTP và nơi lưu "Hay dùng". */
export const createNutritionCatalogApi = ({ client = beClient, storage = defaultStorage } = {}) => {
  // Nạp một lần mỗi phiên; lỗi thì lần sau nạp lại
  const cached = (load) => {
    let pending = null;
    return () => {
      if (!pending) {
        pending = load();
        pending.catch(() => (pending = null));
      }
      return pending;
    };
  };
  const allergens = cached(() => client.get('/nutrition/allergens'));
  const ageGroups = cached(() => client.get('/age-groups'));

  const readFavorites = () => {
    try {
      return new Set(JSON.parse(storage()?.getItem(FAVORITES_KEY) || '[]').map(String));
    } catch {
      return new Set();
    }
  };
  const writeFavorites = (set) => {
    try {
      storage()?.setItem(FAVORITES_KEY, JSON.stringify([...set]));
    } catch {
      // Trình duyệt chặn lưu trữ: bỏ qua, "Hay dùng" chỉ là tiện ích lọc nhanh
    }
  };
  const markFavorite = (id, favorite) => {
    const favorites = readFavorites();
    if (favorite) favorites.add(String(id));
    else favorites.delete(String(id));
    writeFavorites(favorites);
  };

  /* ---------- thực phẩm ---------- */
  const toFood = (f, favorites = readFavorites()) => ({
    id: f.id,
    code: f.code,
    name: f.name,
    group: f.foodGroup,
    unit: f.unit,
    purchaseUnit: f.purchaseUnit,
    purchaseUnitSize: f.purchaseUnitSize,
    stockUnit: f.purchaseUnit,
    purchaseToStock: 1,
    stockUnitSize: f.purchaseUnitSize,
    unitPrice: f.unitPrice ?? null,
    wastePct: f.wastePct ?? 0,
    storage: f.storage,
    nutrition: {
      kcal: f.kcal ?? null,
      protein: f.protein ?? null,
      lipid: f.lipid ?? null,
      glucid: f.glucid ?? null,
      ...Object.fromEntries(MICRONUTRIENTS.map((k) => [k, f[k] ?? null])),
    },
    origin: ['ANIMAL', 'PLANT'].includes(f.origin) ? f.origin : '',
    nutrientSource: f.nutrientSource || '',
    nutrientSourceVersion: f.nutrientSourceVersion || '',
    allergens: (f.allergens || []).map((a) => a.name),
    note: f.note || '',
    status: f.status,
    favorite: favorites.has(String(f.id)),
    history: [],
  });

  const allergenIdsOf = async (names = []) => {
    if (!names.length) return [];
    const list = await allergens();
    return names.map((name) => {
      const found = list.find((a) => sameName(a.name, name));
      if (!found)
        throw Object.assign(new Error(`Chất gây dị ứng "${name}" chưa có trên hệ thống`), { details: { allergens: 'Không hợp lệ' } });
      return found.id;
    });
  };

  const toFoodRequest = async (p) => {
    const purchaseUnitSize = blank(p.purchaseUnitSize)
      ? purchaseUnitSizeOf(p.purchaseToStock, p.stockUnitSize)
      : Number(p.purchaseUnitSize);
    return {
      ...(p.code ? { code: p.code } : {}),
      name: text(p.name),
      foodGroup: p.group,
      unit: p.unit,
      purchaseUnit: text(p.purchaseUnit),
      purchaseUnitSize,
      unitPrice: numOrNull(p.unitPrice),
      kcal: numOrNull(p.nutrition?.kcal),
      protein: numOrNull(p.nutrition?.protein),
      lipid: numOrNull(p.nutrition?.lipid),
      glucid: numOrNull(p.nutrition?.glucid),
      ...Object.fromEntries(MICRONUTRIENTS.map((k) => [k, numOrNull(p.nutrition?.[k])])),
      origin: ['ANIMAL', 'PLANT'].includes(p.origin) ? p.origin : null,
      nutrientSource: text(p.nutrientSource),
      nutrientSourceVersion: text(p.nutrientSourceVersion),
      wastePct: blank(p.wastePct) ? 0 : Number(p.wastePct),
      storage: ['FRESH', 'DRY'].includes(p.storage) ? p.storage : defaultStorageOf(p.group),
      note: text(p.note),
      allergenIds: await allergenIdsOf(p.allergens || []),
    };
  };

  const setFoodStatus = (id, status) => client.patch(`/nutrition/foods/${id}/status`, { status });

  // PUT/POST không nhận status ⇒ đổi trạng thái bằng PATCH khi khác
  const putFood = async (id, payload) => {
    const body = await toFoodRequest(payload);
    let saved = id ? await client.put(`/nutrition/foods/${id}`, body) : await client.post('/nutrition/foods', body);
    if (payload.status && payload.status !== saved.status) saved = await setFoodStatus(saved.id, payload.status);
    return saved;
  };

  const food = withFields(FOOD_FIELDS);

  /* ---------- món ăn ---------- */
  const agMaps = async () => {
    const list = await ageGroups();
    return {
      codeOf: Object.fromEntries(list.map((g) => [String(g.id), g.code])),
      idOf: Object.fromEntries(list.map((g) => [g.code, g.id])),
    };
  };

  const toDish = (d, codeOf) => {
    const rows = new Map();
    (d.ingredients || []).forEach((r) => {
      const key = String(r.foodId);
      if (!rows.has(key)) rows.set(key, { foodId: key, portions: {} });
      rows.get(key).portions[codeOf[String(r.ageGroupId)] || String(r.ageGroupId)] = r.gramsPerChild;
    });
    const ingredients = [...rows.values()].map((r) => {
      const values = Object.values(r.portions).filter((v) => v != null);
      return { ...r, quantity: r.portions['ag-4'] ?? values[0] ?? 0 };
    });
    return {
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.dishType,
      description: d.description || '',
      status: d.status,
      reference: !!d.reference,
      ingredients,
      allergens: (d.allergens || []).map((a) => a.name),
      nutritionByAgeGroup: (d.nutritionByAgeGroup || []).map((n) => ({ ...n, ageGroupId: codeOf[String(n.ageGroupId)] || n.ageGroupId })),
      usedInMenus: [],
      history: [],
    };
  };

  const toDishRequest = (p, idOf) => ({
    ...(p.code ? { code: p.code } : {}),
    name: text(p.name),
    dishType: p.type,
    description: text(p.description),
    // Ô định lượng trống hoặc 0 = nhóm tuổi đó không dùng thực phẩm này
    ingredients: (p.ingredients || [])
      .filter((r) => r.foodId)
      .flatMap((r) =>
        Object.entries(r.portions || {})
          .filter(([, v]) => !blank(v) && Number(v) > 0)
          .map(([code, v]) => {
            if (idOf[code] == null)
              throw Object.assign(new Error(`Nhóm tuổi ${code} chưa có trên hệ thống`), {
                details: { ingredients: 'Nhóm tuổi không hợp lệ' },
              });
            return { foodId: r.foodId, ageGroupId: idOf[code], gramsPerChild: Number(v) };
          }),
      ),
  });

  const getDishDetail = async (id) => {
    const [{ codeOf }, d] = await Promise.all([agMaps(), client.get(`/nutrition/dishes/${id}`)]);
    return toDish(d, codeOf);
  };
  const setDishStatus = (id, status) => client.patch(`/nutrition/dishes/${id}/status`, { status });
  const dish = withFields(DISH_FIELDS);

  /* ---------- nhà cung cấp ---------- */
  // BE chưa có mã NCC: mã hiển thị sinh từ id (NCC001, NCC002…) — cố định, không trùng, cùng dạng mã của bản demo
  const supplierCode = (id) => `NCC${String(id).padStart(3, '0')}`;
  const toSupplier = (s) => ({
    id: s.id,
    code: supplierCode(s.id),
    name: s.name,
    phone: s.phone || '',
    address: s.address || '',
    contactName: s.deliveryPerson || '',
    // BE trả null cho người chỉ xem ⇒ không có khóa, màn ẩn dòng CCCD
    ...(s.idCard ? { idCard: s.idCard } : {}),
    status: s.status,
    // BE chưa nối phiếu nhập kho với nhà cung cấp
    receiptCount: null,
    receipts: [],
  });
  const supplier = withFields(SUPPLIER_FIELDS);

  /* ---------- cấu hình nhóm tuổi (thiết lập dinh dưỡng) ---------- */
  const toVersion = (v) => ({
    id: v.id,
    effectiveFrom: v.effectiveFrom,
    price: v.mealPrice ?? null,
    basis: v.normBasis || '',
    dailyKcalNeed: v.dailyKcalNeed ?? '',
    // Khoảng chưa đặt (cả hai đầu null) không có khóa ⇒ màn hiện "Chưa đặt định mức"
    norms: Object.fromEntries(
      Object.entries(NORM_STEMS)
        .filter(([, stem]) => v[`${stem}Min`] != null || v[`${stem}Max`] != null)
        .map(([key, stem]) => [key, [v[`${stem}Min`] ?? '', v[`${stem}Max`] ?? '']]),
    ),
    editable: !!v.editable,
  });

  const toConfigRequest = (g, effectiveFrom, basis, ageGroupId) => ({
    ageGroupId,
    effectiveFrom,
    mealPrice: Number(g.price),
    normBasis: text(basis),
    dailyKcalNeed: numOrNull(g.dailyKcalNeed),
    ...Object.fromEntries(
      Object.entries(NORM_STEMS).flatMap(([key, stem]) => {
        const [min, max] = g.norms?.[key] || [];
        return [
          [`${stem}Min`, numOrNull(min)],
          [`${stem}Max`, numOrNull(max)],
        ];
      }),
    ),
  });
  const sameValue = (x, y) => (x == null || y == null ? x == null && y == null : x === y || Number(x) === Number(y));
  const sameConfig = (a, b) =>
    Object.keys(a).every((k) => (k === 'effectiveFrom' ? true : k === 'normBasis' ? (a[k] || '') === (b[k] || '') : sameValue(a[k], b[k])));

  const versionsOf = (beId) => client.get(`/nutrition/age-group-configs/${beId}/versions`);

  return {
    /* thực phẩm */
    async listFoods(filters = {}) {
      const rows = await client.get('/nutrition/foods', {
        params: params({ keyword: filters.keyword, foodGroup: filters.group, status: filters.status }),
      });
      const favorites = readFavorites();
      return rows
        .map((f) => toFood(f, favorites))
        .filter((f) => !filters.allergen || f.allergens.some((a) => sameName(a, filters.allergen)));
    },

    async getFood(id) {
      const f = await client.get(`/nutrition/foods/${id}`);
      // BE chưa trả món dùng thực phẩm và khóa đơn vị theo kho
      return { ...toFood(f), usedInDishes: [], unitsLocked: false };
    },

    saveFood: (id, payload) =>
      food(async () => {
        const result = await putFood(id, payload);
        if (payload.favorite !== undefined) markFavorite(result.id, payload.favorite);
        notifyChanged();
        return toFood(result);
      }),

    /**
     * Một lần POST /import {items:[{id?, data}]}: BE ghi cả dòng mới lẫn dòng sửa hoặc không ghi dòng nào.
     * Dòng sửa chỉ mang ô đổi ⇒ ghép vào bản hiện tại (đọc danh sách một lần) vì BE cần đủ FoodRequest.
     */
    async saveFoodsBulk(items = []) {
      if (!items.length) return { created: 0, updated: 0 };
      const current = items.some((it) => it.id) ? await client.get('/nutrition/foods') : [];
      const byId = new Map(current.map((f) => [String(f.id), toFood(f)]));
      const defaults = { purchaseUnit: 'kg', purchaseUnitSize: 1000, unit: 'g', allergens: [], note: '' };
      const body = {
        items: await Promise.all(
          items.map(async (it) => {
            if (!it.id) return { data: await toFoodRequest({ ...defaults, ...it.data }) };
            const before = byId.get(String(it.id));
            if (!before)
              throw Object.assign(new Error('Thực phẩm không còn trên hệ thống'), { details: { [`${it.key}.name`]: 'Không tìm thấy' } });
            const merged = { ...before, ...it.data, nutrition: { ...before.nutrition, ...(it.data.nutrition || {}) } };
            return { id: Number(it.id), data: await toFoodRequest(merged) };
          }),
        ),
      };
      try {
        const result = await client.post('/nutrition/foods/import', body);
        notifyChanged();
        return { created: result?.created ?? 0, updated: result?.updated ?? 0 };
      } catch (error) {
        // Lỗi BE theo `items[i].data.field` ⇒ `${key}.${field}` của dòng tương ứng
        if (error?.details) {
          error.details = Object.fromEntries(
            Object.entries(error.details).map(([k, msg]) => {
              const m = k.match(/^items\[(\d+)\](?:\.data)?\.?(\w*)/);
              if (!m || !items[m[1]]) return [k, msg];
              const field = FOOD_FIELDS[m[2]] || m[2] || 'name';
              return [`${items[m[1]].key}.${field}`, msg];
            }),
          );
        }
        throw error;
      }
    },

    async setFoodFavorite(id, favorite) {
      markFavorite(id, favorite);
      notifyChanged();
      return { id, favorite: !!favorite };
    },

    async deleteFood(id) {
      await setFoodStatus(id, INACTIVE);
      notifyChanged();
    },

    /* món ăn — chỉ món của trường; món tham khảo vẫn ở thư viện tham khảo */
    async listDishes(filters = {}) {
      if (filters.status === DRAFT) return [];
      const rows = await client.get('/nutrition/dishes', {
        params: params({ keyword: filters.keyword, dishType: filters.type, status: filters.status, reference: false }),
      });
      // BE trả đủ chi tiết (định lượng, dinh dưỡng, dị ứng) ngay trong danh sách
      const { codeOf } = await agMaps();
      return rows.map((d) => toDish(d, codeOf)).filter((d) => !filters.allergen || d.allergens.some((a) => sameName(a, filters.allergen)));
    },

    getDish: (id) => getDishDetail(id),

    saveDish: (id, payload) =>
      dish(async () => {
        const { idOf, codeOf } = await agMaps();
        const body = toDishRequest(payload, idOf);
        let saved = id ? await client.put(`/nutrition/dishes/${id}`, body) : await client.post('/nutrition/dishes', body);
        const status = payload.status === ACTIVE ? ACTIVE : INACTIVE;
        if (payload.status && status !== saved.status) saved = await setDishStatus(saved.id, status);
        notifyChanged();
        return toDish(saved, codeOf);
      }),

    async deleteDish(id) {
      await setDishStatus(id, INACTIVE);
      notifyChanged();
    },

    /* nhà cung cấp — cùng tên hàm với kitchenService */
    async getSuppliers({ keyword, status } = {}) {
      const rows = await client.get('/nutrition/suppliers', { params: params({ keyword, status }) });
      return rows.map(toSupplier);
    },

    async getSupplier({ id }) {
      return toSupplier(await client.get(`/nutrition/suppliers/${id}`));
    },

    saveSupplier: ({ id = null, ...payload }) =>
      supplier(async () => {
        const body = {
          name: text(payload.name),
          phone: text(payload.phone),
          address: text(payload.address),
          deliveryPerson: text(payload.contactName),
          idCard: text(payload.idCard),
        };
        let saved = id ? await client.put(`/nutrition/suppliers/${id}`, body) : await client.post('/nutrition/suppliers', body);
        if (payload.status && payload.status !== saved.status)
          saved = await client.patch(`/nutrition/suppliers/${saved.id}/status`, { status: payload.status });
        notifyChanged();
        return toSupplier(saved);
      }),

    async deleteSupplier({ id }) {
      await client.patch(`/nutrition/suppliers/${id}/status`, { status: INACTIVE });
      notifyChanged();
      return { id };
    },

    /*
     * Thiết lập dinh dưỡng — cùng dạng với mock: một bản ghi mỗi nhóm tuổi (id FE 'ag-x' = code nhóm tuổi BE).
     * Form lấy bản mới nhất; `versions` (mới trước) có `editable` = chưa tới ngày hiệu lực. Giá chỉ theo ngày (NUT-19);
     * bữa ăn lấy từ mealSessions của nhóm tuổi (Cấu hình trường), chỉ đọc.
     */
    async listNutritionSetups() {
      const groups = [...(await ageGroups())].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const all = await Promise.all(groups.map((g) => versionsOf(g.id)));
      return groups.map((g, i) => {
        const versions = (all[i] || []).map(toVersion);
        const latest = versions[0];
        return {
          ageGroupId: g.code,
          enabled: true,
          mealsReadOnly: true,
          basis: latest?.basis || '',
          price: latest?.price ?? '',
          meals: (g.mealSessions || []).map((code) => ({ code, name: MEAL_SESSION_LABELS[code] || code, countAs: code })),
          norms: latest?.norms || {},
          dailyKcalNeed: latest?.dailyKcalNeed ?? '',
          childCount: null,
          versions,
          prices: versions.map((v) => ({ id: v.id, price: v.price, effectiveFrom: v.effectiveFrom })),
        };
      });
    },

    /**
     * payload { effectiveFrom, basis, groups } như mock. Nhóm không đổi so với bản mới nhất ⇒ bỏ qua; các nhóm còn lại gửi
     * một lần POST /batch: BE sửa bản cùng ngày (chưa hiệu lực) hoặc tạo bản mới, lỗi một nhóm thì không lưu nhóm nào.
     * Lỗi `items[i].x` → `${ageGroupId}.price|norms.x` của nhóm tương ứng.
     */
    async saveNutritionSetups(payload) {
      const { idOf } = await agMaps();
      const changed = [];
      for (const g of payload.groups || []) {
        const beId = idOf[g.ageGroupId];
        if (beId == null) continue;
        const body = toConfigRequest(g, payload.effectiveFrom, payload.basis, beId);
        const latest = (await versionsOf(beId))[0];
        if (latest && sameConfig(body, { ...latest, ageGroupId: beId })) continue;
        changed.push({ ageGroupId: g.ageGroupId, body });
      }
      if (!changed.length) return { saved: 0 };
      try {
        await client.post('/nutrition/age-group-configs/batch', { items: changed.map((c) => c.body) });
      } catch (error) {
        if (error?.details) {
          error.details = Object.fromEntries(
            Object.entries(error.details).map(([k, msg]) => {
              const m = k.match(/^items\[(\d+)\]\.(\w+)$/);
              const key = m ? m[2] : k;
              const field = configFieldOf(key);
              const group = m ? changed[m[1]]?.ageGroupId : null;
              return [field && group ? `${group}.${field}` : key, msg];
            }),
          );
        }
        throw error;
      }
      notifyChanged();
      return { saved: changed.length };
    },

    /**
     * Định mức, bữa và giá/ngày (NUT-19) đang hiệu lực ngày `date` cho các kiểm tra thực đơn: cùng dạng phần tương ứng của
     * getCatalog mock. Giá BE tính theo ngày ⇒ `pricePerDay` để kiểm tra tuần so chi phí từng ngày với giá ngày.
     */
    async getEffectiveSetups(date) {
      const [groups, configs] = await Promise.all([ageGroups(), client.get('/nutrition/age-group-configs', { params: params({ date }) })]);
      const byGroup = new Map((configs || []).map((c) => [String(c.ageGroupId), toVersion(c)]));
      const nutritionSetups = [...groups]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((g) => {
          const v = byGroup.get(String(g.id));
          return {
            ageGroupId: g.code,
            enabled: true,
            basis: v?.basis || '',
            price: v?.price ?? '',
            meals: (g.mealSessions || []).map((code) => ({ code, name: MEAL_SESSION_LABELS[code] || code, countAs: code })),
            norms: v?.norms || {},
            dailyKcalNeed: v?.dailyKcalNeed ?? '',
          };
        });
      const mealPrices = groups
        .filter((g) => byGroup.get(String(g.id))?.price != null)
        .map((g) => {
          const v = byGroup.get(String(g.id));
          return { id: v.id, ageGroupId: g.code, price: Number(v.price), effectiveFrom: v.effectiveFrom, effectiveTo: null };
        });
      return {
        nutritionSetups,
        norms: Object.fromEntries(nutritionSetups.map((x) => [x.ageGroupId, x.norms])),
        mealPrices,
        pricePerDay: true,
      };
    },
  };
};

export const nutritionCatalogApi = createNutritionCatalogApi();
