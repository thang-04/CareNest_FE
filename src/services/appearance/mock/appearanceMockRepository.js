import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { APPEARANCE_MODE, DEFAULT_APPEARANCE, SCENES } from '@/models/appearance/scenes';
import { canEditAppearance } from '@/utils/appearance/appearancePermissions';

/** Mock của GET/PUT /school/appearance; kiểm quyền và dữ liệu như BE dự kiến. */
export const appearanceMockRepository = {
  async getAppearance() {
    await delay(60);
    return clone(readDb().appearance || DEFAULT_APPEARANCE);
  },

  async saveAppearance(form, user) {
    await delay();
    if (!canEditAppearance(user)) throw new ApiError(403, 'Bạn không có quyền đổi giao diện của trường');
    const ids = SCENES.map((s) => s.id);
    const enabled = (form.enabledSceneIds || []).filter((id) => ids.includes(id));
    if (!enabled.length) throw new ApiError(400, 'Cần bật ít nhất một tranh', { enabledSceneIds: 'Cần bật ít nhất một tranh' });
    if (!Object.values(APPEARANCE_MODE).includes(form.mode)) throw new ApiError(400, 'Chế độ không hợp lệ');
    if (form.mode === APPEARANCE_MODE.FIXED && !enabled.includes(form.pinnedSceneId)) {
      throw new ApiError(400, 'Chọn tranh để ghim', { pinnedSceneId: 'Chọn một tranh đang bật để ghim' });
    }
    return writeDb((db) => {
      db.appearance = {
        mode: form.mode,
        pinnedSceneId: form.pinnedSceneId || enabled[0],
        enabledSceneIds: enabled,
        updatedBy: user.fullName,
        updatedAt: new Date().toISOString(),
      };
      return clone(db.appearance);
    });
  },
};
