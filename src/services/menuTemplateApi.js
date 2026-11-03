import { beClient } from '@/services/http/beClient';

/*
 * Bộ thực đơn mẫu 4 tuần theo khối trên BE `/nutrition/menu-templates` (NUT-13): lưu ghi đè cả lưới
 * items[{ weekNo 1–4, weekday 1–5, session, dishId }]; ngừng dùng bằng PATCH status. Cờ canEdit, các bữa của khối do BE trả.
 */
const blank = (v) => v === '' || v == null;
const params = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));

const toTemplate = (t) => ({ ...t, sessions: t?.sessions || [], items: t?.items || [] });

/** Factory để test thay client HTTP. */
export const createMenuTemplateApi = ({ client = beClient } = {}) => ({
  async listTemplates({ block, status } = {}) {
    return ((await client.get('/nutrition/menu-templates', { params: params({ block, status }) })) || []).map(toTemplate);
  },

  async getTemplate(id) {
    return toTemplate(await client.get(`/nutrition/menu-templates/${id}`));
  },

  /** `body` = { name, seasonLabel, block, items[{ weekNo, weekday, session, dishId }] }. */
  async saveTemplate(id, body) {
    return toTemplate(
      id ? await client.put(`/nutrition/menu-templates/${id}`, body) : await client.post('/nutrition/menu-templates', body),
    );
  },

  async setTemplateStatus(id, status) {
    return toTemplate(await client.patch(`/nutrition/menu-templates/${id}/status`, { status }));
  },
});

export const menuTemplateApi = createMenuTemplateApi();
