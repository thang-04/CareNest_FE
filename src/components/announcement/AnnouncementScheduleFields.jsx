import { Checkbox, DateInput, FormField, SelectField, TextField } from '@/components';
import { Switch } from '@/components/ui/Switch';
import { FREQUENCIES, INTERVAL_OPTIONS, WEEKDAYS } from '@/utils/announcement/scheduleRecurrence.mjs';

/**
 * Cài đặt lặp của lịch gửi: mỗi ngày, hằng tuần (nhiều thứ, cách 1–4 tuần) hoặc hằng tháng, kèm ngày bắt đầu/kết thúc.
 * `errors`: lỗi theo tên trường (do form kiểm hoặc BE trả) hiện ngay dưới ô tương ứng.
 */
export default function AnnouncementScheduleFields({ value, onChange, errors = {} }) {
  const change = (key, next) => onChange({ ...value, [key]: next });
  const toggleDay = (day) =>
    change('daysOfWeek', value.daysOfWeek.includes(day) ? value.daysOfWeek.filter((d) => d !== day) : [...value.daysOfWeek, day]);
  return (
    <div className="announcement-form">
      <div className="announcement-fields">
        <SelectField
          label="Lặp lại"
          value={value.frequency}
          onChange={(event) => change('frequency', event.target.value)}
          error={errors.frequency}
        >
          {FREQUENCIES.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        {value.frequency === 'WEEKLY' && (
          <SelectField
            fieldClassName="announcement-field--short"
            label="Số tuần"
            value={value.intervalWeeks}
            onChange={(event) => change('intervalWeeks', Number(event.target.value))}
            error={errors.intervalWeeks}
          >
            {INTERVAL_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        )}
        {value.frequency === 'MONTHLY' && (
          <TextField
            fieldClassName="announcement-field--short"
            label="Ngày trong tháng"
            type="number"
            min="1"
            max="31"
            required
            value={value.dayOfMonth ?? ''}
            onChange={(event) => change('dayOfMonth', event.target.value ? Number(event.target.value) : '')}
            error={errors.dayOfMonth}
            hint="Tháng không có ngày này thì gửi vào ngày cuối tháng."
          />
        )}
        <TextField
          fieldClassName="announcement-field--short"
          label="Giờ gửi (giờ Việt Nam)"
          type="time"
          required
          value={value.sendTime}
          onChange={(event) => change('sendTime', event.target.value)}
          error={errors.sendTime}
        />
      </div>
      {value.frequency === 'WEEKLY' && (
        <FormField label="Gửi vào các thứ" required error={errors.daysOfWeek}>
          <div className="announcement-roles announcement-weekdays" role="group" aria-label="Các thứ trong tuần">
            {WEEKDAYS.map((day) => (
              <label key={day.value} className="announcement-check">
                <Checkbox checked={value.daysOfWeek.includes(day.value)} aria-label={day.label} onChange={() => toggleDay(day.value)} />
                <span aria-hidden="true">{day.short}</span>
              </label>
            ))}
          </div>
        </FormField>
      )}
      <div className="announcement-fields">
        <FormField label="Ngày bắt đầu" hint="Để trống: bắt đầu từ hôm nay." error={errors.startDate}>
          <DateInput value={value.startDate} onChange={(next) => change('startDate', next)} />
        </FormField>
        <FormField label="Ngày kết thúc" hint="Để trống: lặp mãi cho tới khi tắt." error={errors.endDate}>
          <DateInput value={value.endDate} min={value.startDate || undefined} onChange={(next) => change('endDate', next)} />
        </FormField>
      </div>
      <p className="muted text-sm">Thông báo vẫn được gửi vào ngày nghỉ.</p>
      {/* Lịch mới mặc định bật; tắt nếu chưa muốn gửi. */}
      <div className="announcement-check">
        <Switch checked={value.active} label="Bật lịch gửi" onChange={(next) => change('active', next)} />
        <span aria-hidden="true">{value.active ? 'Đang bật — tự gửi theo lịch' : 'Đã tắt — không gửi cho tới khi bật lại'}</span>
      </div>
    </div>
  );
}
