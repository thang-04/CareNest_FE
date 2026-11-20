import { useState, useSyncExternalStore } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/form/Field';
import { AlertTriangle, Clock } from '@/components/ui/icons';
import {
  DEV_TOOLS_ENABLED,
  clearDevClock,
  devNow,
  getDevMarks,
  isDevClockActive,
  setDevClockTo,
  subscribeDevMarks,
} from '@/utils/devClock';

const ZONE = 'Asia/Ho_Chi_Minh';
const STEP_MS = 30 * 60 * 1000;
const weekday = new Intl.DateTimeFormat('vi-VN', { timeZone: ZONE, weekday: 'long' });

// Ô datetime-local không có múi giờ: đọc/ghi theo giờ trường (+07:00) để không lệch theo máy tester
const toInput = (date) => date.toLocaleString('sv-SE', { timeZone: ZONE, hour12: false }).slice(0, 16).replace(' ', 'T');
const fromInput = (value) => new Date(`${value}:00+07:00`);
// "Thứ Hai, 16/11/2026 08:15" theo giờ trường
const fullLabel = (date) => {
  const v = toInput(date);
  const day = weekday.format(date);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)} ${v.slice(11, 16)}`;
};
const shortLabel = (date) => {
  const v = toInput(date);
  return `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 16)}`;
};

// Tải lại trang để mọi màn tính lại theo giờ mới (dữ liệu, trạng thái nút, thông báo)
const travelTo = (date) => {
  setDevClockTo(date);
  window.location.reload();
};
const backToRealTime = () => {
  clearDevClock();
  window.location.reload();
};

const MARK_STEPS = [
  { label: 'Trước', hint: '30 phút trước mốc', ms: -STEP_MS },
  { label: 'Đúng lúc', hint: 'Đúng thời điểm mốc', ms: 0 },
  { label: 'Sau', hint: '30 phút sau mốc', ms: STEP_MS },
];

/** Dev Mode giả lập ngày giờ cho tester: nút DEV nổi, dải cảnh báo khi đang giả lập, pop-up chọn mốc của màn. Không có ở production. */
export function DevClockWidget() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const marks = useSyncExternalStore(subscribeDevMarks, getDevMarks);

  if (!DEV_TOOLS_ENABLED) return null;

  const active = isDevClockActive();
  const picked = value ? fromInput(value) : null;
  const valid = picked && !Number.isNaN(picked.getTime());

  const openPopup = () => {
    setValue(toInput(devNow()));
    setOpen(true);
  };

  return (
    <>
      {active && (
        <div className="dev-clock-banner no-print" role="status">
          <AlertTriangle size={16} />
          <span>
            Dev Mode — đang giả lập <strong>{fullLabel(devNow())}</strong>
          </span>
          <Button size="sm" onClick={openPopup}>
            Đổi
          </Button>
          <Button size="sm" variant="ghost" onClick={backToRealTime}>
            Tắt
          </Button>
        </div>
      )}
      <Button
        className={`dev-clock-fab no-print${active ? ' dev-clock-fab--active' : ''}`}
        icon={Clock}
        onClick={openPopup}
        aria-label={active ? `Dev Mode đang giả lập ${fullLabel(devNow())}` : 'Mở Dev Mode giả lập ngày giờ'}
        title="Dev Mode: giả lập ngày giờ"
      >
        <span className="dev-clock-fab__label">{active ? `DEV ${shortLabel(devNow())}` : 'DEV'}</span>
      </Button>
      <Modal
        open={open}
        title="Dev Mode — giả lập ngày giờ"
        size="md"
        onClose={() => setOpen(false)}
        footer={
          <>
            {active && (
              <Button variant="ghost" onClick={backToRealTime}>
                Tắt Dev Mode (về giờ thật)
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Đóng</Button>
          </>
        }
      >
        <div className="dev-clock">
          <div className={`dev-clock__hero${active ? ' dev-clock__hero--active' : ''}`}>
            <span className="dev-clock__hero-caption">{active ? 'Đang giả lập' : 'Đang dùng giờ thật'}</span>
            <strong className="dev-clock__hero-time">{fullLabel(devNow())}</strong>
            {active && <span className="dev-clock__hero-caption">Giờ thật: {fullLabel(new Date())}</span>}
          </div>

          <section className="dev-clock__section">
            <h3 className="dev-clock__heading">Mốc của màn này</h3>
            {marks.length ? (
              <ul className="dev-clock__marks">
                {marks.map((m) => (
                  <li key={`${m.label}|${m.at}`} className="dev-clock__mark">
                    <div className="dev-clock__mark-text">
                      <span>{m.label}</span>
                      <span className="dev-clock__mark-at">{fullLabel(new Date(m.at))}</span>
                    </div>
                    <div className="dev-clock__mark-actions">
                      {MARK_STEPS.map((s) => (
                        <Button
                          key={s.label}
                          size="sm"
                          variant={s.ms === 0 ? 'outline-primary' : undefined}
                          title={s.hint}
                          onClick={() => travelTo(new Date(Date.parse(m.at) + s.ms))}
                        >
                          {s.label}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dev-clock__empty">
                Màn này chưa có mốc. Mở màn có hạn (điểm danh, đánh giá ngày, kế hoạch giáo dục, năm học, đợt khám) hoặc chọn tay bên dưới.
              </p>
            )}
          </section>

          <section className="dev-clock__section">
            <h3 className="dev-clock__heading">Chọn tay</h3>
            <div className="dev-clock__manual">
              <TextField label="Ngày giờ (giờ Việt Nam)" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
              <Button variant="primary" disabled={!valid} onClick={() => travelTo(picked)}>
                Áp dụng
              </Button>
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}
