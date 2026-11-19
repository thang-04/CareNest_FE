import { SelectField, TextField } from '@/components';
import { Switch } from '@/components/ui/Switch';

export default function AnnouncementScheduleFields({ value, onChange }) {
  const change = (key, next) => onChange({ ...value, [key]: next });
  return (
    <div className="announcement-form">
      <div className="announcement-fields">
        <SelectField label="Tần suất" value={value.frequency} onChange={(event) => change('frequency', event.target.value)}>
          <option value="WEEKLY">Hằng tuần</option>
          <option value="MONTHLY">Hằng tháng</option>
        </SelectField>
        {value.frequency === 'WEEKLY' ? (
          <SelectField label="Ngày gửi" value={value.dayOfWeek} onChange={(event) => change('dayOfWeek', Number(event.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <option value={day} key={day}>
                {day === 7 ? 'Chủ nhật' : `Thứ ${day + 1}`}
              </option>
            ))}
          </SelectField>
        ) : (
          <TextField
            fieldClassName="announcement-field--short"
            label="Ngày trong tháng"
            type="number"
            min="1"
            max="31"
            required
            value={value.dayOfMonth ?? ''}
            onChange={(event) => change('dayOfMonth', event.target.value ? Number(event.target.value) : '')}
          />
        )}
        <TextField
          fieldClassName="announcement-field--short"
          label="Giờ gửi (giờ Việt Nam)"
          type="time"
          required
          value={value.sendTime}
          onChange={(event) => change('sendTime', event.target.value)}
        />
      </div>
      {/* Lịch mới mặc định bật; tắt nếu chưa muốn gửi. */}
      <div className="announcement-check">
        <Switch checked={value.active} label="Bật lịch gửi" onChange={(next) => change('active', next)} />
        <span aria-hidden="true">{value.active ? 'Đang bật — tự gửi theo lịch' : 'Đã tắt — không gửi cho tới khi bật lại'}</span>
      </div>
    </div>
  );
}
