import { AlertTriangle, ShieldCheck, Sparkles } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { TextField } from '@/components/form/Field';

const SEASON_TABS = [
  { key: '', label: 'Không chọn' },
  { key: 'Xuân', label: 'Xuân' },
  { key: 'Hạ', label: 'Hạ' },
  { key: 'Thu', label: 'Thu' },
  { key: 'Đông', label: 'Đông' },
];

/**
 * Bước 1 của modal AI soạn thực đơn: khung "AI sẽ bám theo" (mỗi điều kiện một dòng có icon, dị ứng thành chip),
 * chọn mùa, mong muốn thêm kèm gợi ý bấm nhanh, cảnh báo ghi đè và dòng quyền riêng tư.
 * facts: [{ icon, label, value }]; allergyRows: số trẻ dị ứng tổng hợp (không tên trẻ).
 */
export function AiBrief({ intro, facts, allergyRows, season, onSeason, wishes, onWishes, wishHints = [], replaceNote }) {
  const addHint = (hint) => {
    if (wishes.toLowerCase().includes(hint.toLowerCase())) return;
    onWishes((wishes ? `${wishes.replace(/[,\s]+$/, '')}, ` : '') + hint.toLowerCase());
  };

  return (
    <div className="td-aib">
      <div className="td-aib__intro">
        <span className="td-aib__spark" aria-hidden="true">
          <Sparkles size={18} />
        </span>
        <p className="td-flat">{intro}</p>
      </div>

      <section className="td-aib__facts" aria-label="Điều kiện AI bám theo">
        <h3 className="td-aib__title">AI sẽ bám theo</h3>
        <dl className="td-aib__list">
          {facts.map(({ icon: Icon, label, value }) => (
            <div key={label} className="td-aib__row">
              <dt>
                <Icon size={16} aria-hidden="true" /> {label}
              </dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="td-aib__row">
            <dt>
              <AlertTriangle size={16} aria-hidden="true" /> Tránh dị ứng
            </dt>
            <dd>
              {allergyRows.length ? (
                <span className="td-chips">
                  {allergyRows.map((r) => (
                    <span key={r.allergen} className="chip chip--red">
                      {r.allergen} · {r.childCount} trẻ
                    </span>
                  ))}
                </span>
              ) : (
                <span className="muted">Nhóm không có trẻ dị ứng</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tab không phải ô nhập nên không bọc FormField (nhãn htmlFor không trỏ được); tablist tự mang aria-label */}
      <div className="field">
        <span className="field__label">Mùa</span>
        <Tabs variant="pill" ariaLabel="Mùa" value={season} onChange={onSeason} items={SEASON_TABS} className="td-aib__seasons" />
        <span className="field__hint">Không bắt buộc. AI ưu tiên món hợp mùa.</span>
      </div>

      <div className="td-aib__wish">
        <TextField
          label="Mong muốn thêm"
          maxLength={200}
          placeholder="Ví dụ: thứ Sáu có món nước"
          value={wishes}
          onChange={(e) => onWishes(e.target.value)}
        />
        {wishHints.length > 0 && (
          <div className="td-aib__hints" aria-label="Gợi ý nhanh">
            {wishHints.map((h) => (
              <Button key={h} size="sm" variant="ghost" className="td-aib__hint" onClick={() => addHint(h)}>
                + {h}
              </Button>
            ))}
          </div>
        )}
      </div>

      {replaceNote && (
        <div className="alert alert--warning">
          <AlertTriangle size={18} />
          <div>{replaceNote}</div>
        </div>
      )}

      <p className="td-aib__privacy td-flat">
        <ShieldCheck size={15} aria-hidden="true" /> AI chỉ nhận số trẻ dị ứng, không nhận tên trẻ. Kết quả là bản nháp, bạn xem trước rồi
        mới dùng.
      </p>
    </div>
  );
}
