import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ROLES } from '@/models/User';
import { DEFAULT_EDU_CONFIG, withDefaults } from '@/models/education-plan/eduConfig';

/* Fake backend cho cấu hình kế hoạch giáo dục của trường (db.eduConfig). BE thật phải sở hữu và kiểm tra cấu hình này. */
const EDITORS = [ROLES.VICE_PRINCIPAL, ROLES.PRINCIPAL];

export const eduConfigMockRepository = {
  async get() {
    await delay(60);
    return clone(withDefaults(readDb().eduConfig));
  },

  async save(cfg, user) {
    await delay();
    if (!EDITORS.includes(user?.role)) throw new ApiError(403, 'Chỉ Phó hiệu trưởng hoặc Hiệu trưởng sửa được cấu hình');
    const next = withDefaults(cfg);
    // Kế hoạch năm do Phó HT ban hành nên Phó HT luôn là một người ký; tài liệu của lớp cần ít nhất một người duyệt
    if (!next.signers.year.includes(ROLES.VICE_PRINCIPAL)) throw new ApiError(400, 'Kế hoạch năm phải có Phó hiệu trưởng ký');
    if (['branch', 'week'].some((k) => !next.signers[k].length)) throw new ApiError(400, 'Mỗi loại tài liệu cần ít nhất một người duyệt');
    if (!next.weekRows.some((r) => r.key === 'hoc')) throw new ApiError(400, 'Không bỏ được dòng Hoạt động học');
    if (next.weekRows.some((r) => !r.label.trim())) throw new ApiError(400, 'Dòng hoạt động cần có tên');
    const names = next.extraDomains.map((d) => d.trim().toLowerCase());
    if (names.some((n, i) => names.indexOf(n) !== i)) throw new ApiError(400, 'Tên lĩnh vực bị trùng');
    return writeDb((db) => {
      db.eduConfig = clone(next);
      return clone(next);
    });
  },

  async reset(user) {
    return this.save(DEFAULT_EDU_CONFIG, user);
  },
};
