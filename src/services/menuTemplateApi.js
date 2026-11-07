import { beClient } from '@/services/http/beClient';

/*
 * Mẫu thực đơn một ngày theo khối trên BE `/nutrition/menu-templates` (NUT-13): lưu ghi đè danh sách món
 * items[{ session, dishId }]; ngừng dùng bằng PATCH status. Cờ canEdit, các bữa của khối, nhóm tuổi của khối do BE trả.
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

  /** `body` = { name, seasonLabel, block, items[{ session, dishId }] }. */
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
