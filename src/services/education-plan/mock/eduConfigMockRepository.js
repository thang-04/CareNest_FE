import { readDb, writeDb, clone, delay } from '@/mocks/mockDatabase';
import { eduError } from './eduMockErrors';
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
    if (!EDITORS.includes(user?.role)) throw eduError('EDU_CONFIG_FORBIDDEN');
    const next = withDefaults(cfg);
    // Kế hoạch năm do Phó HT ban hành nên Phó HT luôn là một người ký; tài liệu của lớp cần ít nhất một người duyệt
    if (!next.signers.year.includes(ROLES.VICE_PRINCIPAL)) throw eduError('YEAR_PLAN_SIGNER_REQUIRED');
    if (['branch', 'week'].some((k) => !next.signers[k].length)) throw eduError('CLASS_DOC_APPROVER_REQUIRED');
    if (!next.weekRows.some((r) => r.key === 'hoc')) throw eduError('LESSON_ROW_REQUIRED');
    if (next.weekRows.some((r) => !r.label.trim())) throw eduError('REQUIRED_FIELD_MISSING', 'tên dòng hoạt động');
    const names = next.extraDomains.map((d) => d.trim().toLowerCase());
    if (names.some((n, i) => names.indexOf(n) !== i)) throw eduError('DOMAIN_NAME_EXISTS', '');
    return writeDb((db) => {
      db.eduConfig = clone(next);
      return clone(next);
    });
  },

  async reset(user) {
    return this.save(DEFAULT_EDU_CONFIG, user);
  },
};
