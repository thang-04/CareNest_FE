import { useState } from 'react';
import { Save, Search, Users } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/States';
import { normalizeText } from '@/utils/format';
import { leaderOptionAllowed } from '@/utils/school-config/schoolConfigPermissions';

/**
 * Chọn tổ trưởng của một nhóm tuổi, cùng kiểu với Phân công giáo viên: tìm tên, lọc điểm trường, bảng cuộn trong khung.
 * Bấm lần nữa vào người đang chọn để bỏ chọn (lưu khi bỏ chọn = bỏ phân công tổ trưởng).
 * Một nhóm tuổi một tổ trưởng cho cả trường; chọn người đang làm tổ trưởng nhóm khác thì người đó chuyển sang nhóm này.
 */
export function TeamLeaderModal({ group, current, teachers, campuses, campusName, acts, onSave, onClose }) {
  const [value, setValue] = useState(current?.userId || '');
  const [query, setQuery] = useState('');
  const [campus, setCampus] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const kw = normalizeText(query.trim());
  // Chưa làm tổ trưởng nhóm nào lên trước, rồi theo tên
  const rows = teachers
    .filter((t) => (!kw || normalizeText(t.fullName).includes(kw)) && (!campus || t.campusId === campus))
    .sort((a, b) => Number(!!a.leadsGroup) - Number(!!b.leadsGroup) || a.fullName.localeCompare(b.fullName, 'vi'));
  const changed = value !== (current?.userId || '');
  const allowed = leaderOptionAllowed(acts, current?.userId, value);

  const pick = (id) => {
    const next = value === id ? '' : id;
    if (leaderOptionAllowed(acts, current?.userId, next)) {
      setValue(next);
      setError('');
    }
  };

  const save = async () => {
    setSaving(true);
    const result = await onSave(group, value || null);
    setSaving(false);
    // onSave trả câu lỗi khi BE từ chối: giữ hộp mở và báo đỏ
    if (typeof result === 'string') setError(result);
    else if (result !== false) onClose();
  };

  return (
    <Modal
      open
      size="lg"
      title={`Phân công tổ trưởng – ${group.name}`}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving || !changed || !allowed}>
            {saving ? <Spinner small /> : <Save size={16} />} {value ? 'Lưu tổ trưởng' : 'Lưu (bỏ tổ trưởng)'}
          </button>
        </>
      }
    >
      {error && (
        <div className="alert alert--danger mb-12" role="alert">
          {error}
        </div>
      )}
      {teachers.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có giáo viên" description="Cần có tài khoản giáo viên để phân công tổ trưởng." />
      ) : (
        <>
          <div className="sc-tpick__tools">
            <label className="search-box sc-tpick__search">
              <Search size={16} className="muted" />
              <span className="sr-only">Tìm giáo viên</span>
              <input value={query} placeholder="Tìm giáo viên" onChange={(e) => setQuery(e.target.value)} />
            </label>
            <select
              className="select sc-leader-campus"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              aria-label="Lọc điểm trường"
            >
              <option value="">Mọi điểm trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
            <span className="muted text-sm">
              {rows.length}/{teachers.length} giáo viên
            </span>
          </div>
          <div className="table-wrap sc-tpick__table">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th className="center">Chọn</th>
                  <th>Giáo viên</th>
                  <th>Điểm trường</th>
                  <th>Đang là tổ trưởng</th>
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
                  rows.map((t) => (
                    <tr key={t.id}>
                      <td className="center">
                        {/* onClick thay vì onChange: bấm lại vào nút đang chọn thì bỏ chọn */}
                        <input
                          type="radio"
                          name={`sc-leader-${group.id}`}
                          checked={value === t.id}
                          disabled={value !== t.id && !leaderOptionAllowed(acts, current?.userId, t.id)}
                          onChange={() => {}}
                          onClick={() => pick(t.id)}
                          aria-label={`${value === t.id ? 'Bỏ chọn' : 'Chọn'} ${t.fullName} làm tổ trưởng`}
                        />
                      </td>
                      <td className="fw-600">{t.fullName}</td>
                      <td>{campusName(t.campusId)}</td>
                      <td className="text-sm">
                        {t.leadsGroup ? (
                          t.leadsAgeGroupId === group.id ? (
                            'Nhóm này'
                          ) : (
                            <span className="chip chip--orange">{t.leadsGroup} · chọn thì chuyển sang nhóm này</span>
                          )
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
