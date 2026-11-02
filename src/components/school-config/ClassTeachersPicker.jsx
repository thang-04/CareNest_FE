import { useState } from 'react';
import { Search, Users } from '@/components/ui/icons';
import { normalizeText } from '@/utils/format';
import { EmptyState } from '@/components/ui/States';
import { TEACHERS_PER_CLASS } from '@/models/school-config/schoolConfigConstants';

/** Bỏ / tích giáo viên; bỏ tích người đang là chủ nhiệm thì xóa lựa chọn chủ nhiệm (không tự chọn chủ nhiệm). */
export const toggleTeacher = (f, id) => {
  const teacherIds = f.teacherIds.includes(id) ? f.teacherIds.filter((x) => x !== id) : [...f.teacherIds, id];
  return { teacherIds, homeroomTeacherId: teacherIds.includes(f.homeroomTeacherId) ? f.homeroomTeacherId : '' };
};

/**
 * Bảng chọn giáo viên và chủ nhiệm của một lớp; dùng ở Phân công giáo viên và form Thêm / Sửa lớp.
 * Điểm trường nhiều giáo viên: bảng cuộn trong khung, có ô tìm và lọc "chưa có lớp".
 */
export function ClassTeachersPicker({ teachers, classesOf, classId, form, onToggle, onHomeroom, errors = {}, lockedIds = [] }) {
  const [query, setQuery] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const full = form.teacherIds.length >= TEACHERS_PER_CLASS;
  const othersOf = (id) => classesOf(id).filter((c) => c.id !== classId);
  const kw = normalizeText(query.trim());
  // Cô chưa có lớp lên trước, rồi theo tên
  const rows = teachers
    .filter((t) => (!kw || normalizeText(t.fullName).includes(kw)) && (!onlyFree || !othersOf(t.id).length))
    .sort((a, b) => Number(othersOf(a.id).length > 0) - Number(othersOf(b.id).length > 0) || a.fullName.localeCompare(b.fullName, 'vi'));

  if (teachers.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="Điểm trường chưa có giáo viên"
        description="Cần có tài khoản giáo viên thuộc điểm trường để phân công."
      />
    );
  return (
    <>
      <div className="sc-tpick__tools">
        <label className="search-box sc-tpick__search">
          <Search size={16} className="muted" />
          <span className="sr-only">Tìm giáo viên</span>
          <input value={query} placeholder="Tìm giáo viên" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="checkbox text-sm">
          <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> Chỉ giáo viên chưa có lớp
        </label>
        <span className="muted text-sm">
          {rows.length}/{teachers.length} giáo viên
        </span>
      </div>
      <div className="table-wrap sc-tpick__table">
        <table className="table table--grid table--compact">
          <thead>
            <tr>
              <th className="center">Phụ trách lớp</th>
              <th>Giáo viên</th>
              <th>Lớp phụ trách</th>
              <th className="center">Chủ nhiệm</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted center">
                  Không có giáo viên phù hợp.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const checked = form.teacherIds.includes(t.id);
                const others = othersOf(t.id);
                // Mỗi giáo viên dạy một lớp / năm: đang dạy lớp khác thì gỡ ở lớp đó trước
                const busy = !checked && others.length > 0;
                return (
                  <tr key={t.id} className={checked ? 'row--selected' : ''}>
                    <td className="center">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy || (!checked && full) || (checked && lockedIds.includes(t.id))}
                          onChange={() => onToggle(t.id)}
                          aria-label={`Phân công ${t.fullName}`}
                        />
                      </label>
                    </td>
                    <td className="fw-600">{t.fullName}</td>
                    <td className="text-sm">
                      {others.length ? (
                        <span className={busy ? 'text-danger' : undefined}>Đang dạy {others.map((c) => c.name).join(', ')}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="center">
                      <input
                        type="radio"
                        name={`sc-homeroom-${classId || 'new'}`}
                        checked={form.homeroomTeacherId === t.id}
                        disabled={!checked}
                        // Bấm lại vào nút đang chọn thì bỏ chọn chủ nhiệm
                        onChange={() => {}}
                        onClick={() => onHomeroom(form.homeroomTeacherId === t.id ? '' : t.id)}
                        aria-label={`${form.homeroomTeacherId === t.id ? 'Bỏ chọn' : 'Chọn'} ${t.fullName} làm chủ nhiệm`}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {(errors.teacherIds || errors.homeroomTeacherId) && (
        <span className="field__error mt-8" role="alert">
          {errors.teacherIds || errors.homeroomTeacherId}
        </span>
      )}
    </>
  );
}
