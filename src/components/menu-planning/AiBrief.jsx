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
 * Bước 1 của modal AI soạn thực đơn, chia hai cột: trái là điều kiện AI bám theo (mỗi điều kiện một dòng có icon, dị ứng
 * thành chip); phải là phần người dùng chọn (`lead`, mùa, mong muốn thêm kèm gợi ý bấm nhanh, ô riêng từng modal, cảnh báo
 * ghi đè). Dòng quyền riêng tư trải suốt chiều ngang ở cuối. Màn hẹp xếp một cột.
 * facts: [{ icon, label, value }]; allergyRows: số trẻ dị ứng tổng hợp (không tên trẻ), bỏ trống thì không hiện dòng dị ứng;
 * seasons: các tab mùa (mặc định 4 mùa; ít hơn 2 mục thì ẩn ô mùa); privacy: câu quyền riêng tư; lead: phần đầu cột phải
 * (vd. chọn loại gợi ý); children: ô nhập thêm của từng modal (vd. thực phẩm đang thiếu).
 */
export function AiBrief({
  intro,
  facts,
  allergyRows,
  season,
  onSeason,
  seasons = SEASON_TABS,
  wishes,
  onWishes,
  wishHints = [],
  replaceNote,
  privacy = 'AI chỉ nhận số trẻ dị ứng, không nhận tên trẻ. Kết quả là bản nháp, bạn xem trước rồi mới dùng.',
  lead,
  children,
}) {
  const addHint = (hint) => {
    if (wishes.toLowerCase().includes(hint.toLowerCase())) return;
    onWishes((wishes ? `${wishes.replace(/[,\s]+$/, '')}, ` : '') + hint.toLowerCase());
  };

  return (
    <div className="td-aib">
      <div className="td-aib__side">
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
            {allergyRows && (
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
            )}
          </dl>
        </section>
      </div>

      <div className="td-aib__form">
        {lead}

        {/* Tab không phải ô nhập nên không bọc FormField (nhãn htmlFor không trỏ được); tablist tự mang aria-label */}
        {seasons.length > 1 && (
          <div className="field">
            <span className="field__label">Mùa</span>
            <Tabs variant="pill" ariaLabel="Mùa" value={season} onChange={onSeason} items={seasons} className="td-aib__seasons" />
            <span className="field__hint">Không bắt buộc. AI ưu tiên món hợp mùa.</span>
          </div>
        )}

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

        {children}

        {replaceNote && (
          <div className="alert alert--warning">
            <AlertTriangle size={18} />
            <div>{replaceNote}</div>
          </div>
        )}
      </div>

      <p className="td-aib__privacy td-flat">
        <ShieldCheck size={15} aria-hidden="true" /> {privacy}
      </p>
    </div>
  );
}
