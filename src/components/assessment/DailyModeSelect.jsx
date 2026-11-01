import { useNavigate } from 'react-router-dom';

const MODES = [
  { key: 'general', label: 'Hoạt động chung', path: '/assessment/daily' },
  { key: 'skills', label: 'Kiến thức kỹ năng', path: '/assessment/daily/skills' },
];

/**
 * Ô chọn nội dung đánh giá hằng ngày (Tiền 21/10): "Hoạt động chung" là màn ghi sức khỏe, ăn ngủ, cảm xúc, hành vi…;
 * "Kiến thức kỹ năng" là bảng Đạt / Chưa đạt theo giờ của kế hoạch ngày. Đổi màn giữ nguyên lớp và ngày đang chọn.
 */
export function DailyModeSelect({ mode, classId, date }) {
  const navigate = useNavigate();
  const go = (key) => {
    const m = MODES.find((x) => x.key === key);
    const q = new URLSearchParams({ ...(classId ? { classId } : {}), ...(date ? { date } : {}) });
    navigate(`${m.path}?${q}`);
  };
  return (
    <div className="field dg-field-activity">
      <label className="field__label" htmlFor="dg-mode">
        Nội dung đánh giá
      </label>
      <select id="dg-mode" className="select" value={mode} onChange={(e) => go(e.target.value)}>
        {MODES.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
