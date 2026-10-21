import { Info, UserCheck } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { GENDER_LABELS } from '@/models/School';
import {
  COMPANION_OPTIONS,
  COMPANION_RELATIONS,
  GUARDIAN_TO_COMPANION_RELATION,
  HISTORY_ITEMS,
  PREMATURE_OPTIONS,
  YES_NO,
} from '@/models/children/healthExamForm';
import { formatDate, todayInput } from '@/utils/format';
import { ExamChoiceField, ExamNumberField, ExamTextField } from './ExamFields';

/** Bước 1 — Phần I: thông tin hành chính, người đi cùng trẻ, tiền sử. Họ tên, ngày sinh, giới lấy từ hồ sơ, không sửa ở đây. */
export function ExamAdminStep({ form, set, errors, child, campaign, dateRange, disabled }) {
  const a = form.exam.admin;
  const h = form.exam.history;
  const pickGuardian = (g, index) =>
    set('exam.admin.companion', {
      ...a.companion,
      guardianIndex: index,
      fullName: g.fullName,
      relation: GUARDIAN_TO_COMPANION_RELATION[g.relation] || 'Khác',
      phone: g.phone,
      idNumber: g.idNumber || '',
    });

  return (
    <>
      <section className="card wizard-card">
        <h2 className="card__title mb-12">I. Thông tin hành chính</h2>
        {!disabled && (
          <div className="alert alert--info mb-16">
            <Info size={18} />
            <div>
              Hành chính và tiền sử điền sẵn từ hồ sơ trẻ; ô hồ sơ còn trống lấy từ phiếu khám gần nhất. Hỏi lại người đi cùng trẻ. Khi lưu
              kết luận, thay đổi ở hai phần này được cập nhật vào hồ sơ trẻ.
            </div>
          </div>
        )}
        <dl className="info-list mb-16">
          <dt>Họ và tên</dt>
          <dd className="fw-600">{child.fullName.toUpperCase()}</dd>
          <dt>Ngày sinh</dt>
          <dd>{formatDate(child.dateOfBirth)}</dd>
          <dt>Giới</dt>
          <dd>{GENDER_LABELS[child.gender] || child.gender}</dd>
          <dt>Cơ sở giáo dục</dt>
          <dd>
            {child.schoolName} · {child.className}
          </dd>
          <dt>Cơ sở kiểm tra sức khỏe</dt>
          <dd>{campaign.examiner || <span className="muted">Chưa cập nhật ở đợt khám</span>}</dd>
        </dl>
        <div className="grid-2">
          <FormField label="Ngày kiểm tra sức khỏe" required error={errors.date}>
            <input
              type="date"
              className="input"
              value={form.date}
              min={dateRange.min}
              max={dateRange.max}
              disabled={disabled}
              onChange={(e) => set('date', e.target.value)}
            />
          </FormField>
          <ExamTextField
            label="Số CC/CCCD/Hộ chiếu/Mã định danh của trẻ"
            value={a.childIdNumber}
            onChange={(v) => set('exam.admin.childIdNumber', v)}
            error={errors['exam.admin.childIdNumber']}
            hint="Không bắt buộc. 12 chữ số, hoặc số hộ chiếu."
            maxLength={20}
            disabled={disabled}
          />
          <ExamChoiceField
            name="premature"
            label="Sinh non"
            options={PREMATURE_OPTIONS}
            value={a.premature}
            onChange={(v) => set('exam.admin.premature', v)}
            error={errors['exam.admin.premature']}
            disabled={disabled}
          />
          <ExamNumberField
            label="Tuần thai khi sinh (tuần)"
            value={a.gestationWeeks}
            onChange={(v) => set('exam.admin.gestationWeeks', v)}
            error={errors['exam.admin.gestationWeeks']}
            required={a.premature === YES_NO.YES}
            min="20"
            max="42"
            step="1"
            hint="Từ 20 đến 42 tuần"
            disabled={disabled}
          />
          <ExamTextField
            label="Dân tộc"
            value={a.ethnicity}
            onChange={(v) => set('exam.admin.ethnicity', v)}
            error={errors['exam.admin.ethnicity']}
            disabled={disabled}
          />
          <ExamTextField
            label="Đối tượng"
            value={a.beneficiary}
            onChange={(v) => set('exam.admin.beneficiary', v)}
            error={errors['exam.admin.beneficiary']}
            disabled={disabled}
          />
          <ExamTextField
            label="Nguồn chi trả"
            value={a.paymentSource}
            onChange={(v) => set('exam.admin.paymentSource', v)}
            error={errors['exam.admin.paymentSource']}
            disabled={disabled}
          />
          <ExamTextField
            label="Nhóm máu (nếu có)"
            value={a.bloodType}
            onChange={(v) => set('exam.admin.bloodType', v)}
            error={errors['exam.admin.bloodType']}
            disabled={disabled}
          />
          <ExamTextField
            label="Nơi ở — Tỉnh/thành"
            value={a.address.province}
            onChange={(v) => set('exam.admin.address.province', v)}
            error={errors['exam.admin.address.province']}
            disabled={disabled}
          />
          <ExamTextField
            label="Nơi ở — Phường/xã"
            value={a.address.ward}
            onChange={(v) => set('exam.admin.address.ward', v)}
            error={errors['exam.admin.address.ward']}
            disabled={disabled}
          />
          <ExamTextField
            label="Nơi ở — Số nhà/thôn/xóm"
            value={a.address.street}
            onChange={(v) => set('exam.admin.address.street', v)}
            error={errors['exam.admin.address.street']}
            maxLength={300}
            disabled={disabled}
          />
        </div>
      </section>

      <section className="card wizard-card mt-16">
        <h2 className="card__title mb-12">Người đi cùng trẻ</h2>
        <ExamChoiceField
          name="hasCompanion"
          label="Có người đi cùng trẻ khi khám"
          options={COMPANION_OPTIONS}
          value={a.hasCompanion}
          onChange={(v) => set('exam.admin.hasCompanion', v)}
          error={errors['exam.admin.hasCompanion']}
          hint="Có người đi cùng: bác sĩ trao đổi kết luận tại buổi khám và hệ thống ghi lại lần trao đổi này."
          disabled={disabled}
        />
        {a.hasCompanion === YES_NO.YES && (
          <>
            {child.guardians.length > 0 && !disabled && (
              <div className="row row--wrap gap-2 mt-12">
                <span className="muted text-sm">Chọn từ hồ sơ trẻ:</span>
                {child.guardians.map((g, i) => (
                  <button
                    key={`${g.phone}${i}`}
                    type="button"
                    className={`btn btn--sm ${a.companion.guardianIndex === i ? 'btn--primary' : ''}`}
                    aria-pressed={a.companion.guardianIndex === i}
                    onClick={() => pickGuardian(g, i)}
                  >
                    <UserCheck size={14} /> {g.fullName} ({g.relation})
                  </button>
                ))}
              </div>
            )}
            <div className="grid-2 mt-12">
              <ExamTextField
                label="Họ tên người đi cùng trẻ"
                required
                value={a.companion.fullName}
                onChange={(v) => set('exam.admin.companion', { ...a.companion, fullName: v, guardianIndex: null })}
                error={errors['exam.admin.companion.fullName']}
                disabled={disabled}
              />
              <FormField label="Mối quan hệ với trẻ" required error={errors['exam.admin.companion.relation']}>
                <select
                  className="select"
                  value={a.companion.relation}
                  disabled={disabled}
                  onChange={(e) => set('exam.admin.companion.relation', e.target.value)}
                >
                  <option value="">Chọn quan hệ</option>
                  {COMPANION_RELATIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FormField>
              <ExamTextField
                label="Số điện thoại liên hệ"
                value={a.companion.phone}
                onChange={(v) => set('exam.admin.companion.phone', v)}
                error={errors['exam.admin.companion.phone']}
                disabled={disabled}
              />
              <ExamTextField
                label="Số CC/CCCD/Mã định danh người đi cùng"
                value={a.companion.idNumber}
                onChange={(v) => set('exam.admin.companion.idNumber', v)}
                error={errors['exam.admin.companion.idNumber']}
                hint="Không bắt buộc"
                maxLength={20}
                disabled={disabled}
              />
            </div>
          </>
        )}
      </section>

      <section className="card wizard-card mt-16">
        <h2 className="card__title mb-12">Tiền sử</h2>
        <p className="muted text-sm mb-12">Hỏi người đi cùng trẻ. Ghi đúng tên bệnh người nhà báo, không tự ghi chẩn đoán.</p>
        <div className="grid-2">
          {HISTORY_ITEMS.map((item) => (
            <div key={item.key}>
              <ExamChoiceField
                name={`history-${item.key}`}
                label={item.label}
                options={item.options}
                value={h[item.key]}
                onChange={(v) => set(`exam.history.${item.key}`, v)}
                error={errors[`exam.history.${item.key}`]}
                disabled={disabled}
              />
              {item.textKey && h[item.key] === YES_NO.YES && (
                <ExamTextField
                  label={item.textLabel}
                  required
                  value={h[item.textKey]}
                  onChange={(v) => set(`exam.history.${item.textKey}`, v)}
                  error={errors[`exam.history.${item.textKey}`]}
                  maxLength={300}
                  disabled={disabled}
                />
              )}
              {item.dateKey && h[item.key] === YES_NO.YES && (
                <FormField
                  label={item.dateLabel}
                  required
                  error={errors[`exam.history.${item.dateKey}`]}
                  hint="Điền sẵn từ khai báo sức khỏe; hỏi lại người đi cùng. Đổi ngày thì khi lưu kết luận hệ thống báo Hiệu trưởng, Phó hiệu trưởng điểm trường."
                >
                  <input
                    type="date"
                    className="input"
                    value={h[item.dateKey] || ''}
                    min={child.dateOfBirth}
                    max={form.date && form.date < todayInput() ? form.date : todayInput()}
                    disabled={disabled}
                    onChange={(e) => set(`exam.history.${item.dateKey}`, e.target.value)}
                  />
                </FormField>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
