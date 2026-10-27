import { Info, UserCheck } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { GENDER_LABELS } from '@/models/School';
import { COMPANION_OPTIONS, GUARDIAN_TO_COMPANION_RELATION, HISTORY_ITEMS, YES_NO } from '@/models/children/healthExamForm';
import { PREMATURE_LABELS, PROFILE_FIELD_LABELS, formatAddress } from '@/models/children/childProfile';
import { formatDate, todayInput } from '@/utils/format';
import { ExamChoiceField, ExamTextField } from './ExamFields';
import { SplitInfoList } from './SplitInfoList';

const missing = <span className="muted">Chưa cung cấp</span>;
const show = (v) => (v === '' || v == null ? missing : v);

/**
 * Bước 1 — Phần I (user chốt 2026-10-22). Hành chính lấy từ hồ sơ trẻ, chỉ xem; Hiệu trưởng, Phó hiệu trưởng sửa ở hồ sơ.
 * Giáo viên nhập ngày khám, chọn người đi cùng trong phụ huynh của hồ sơ; tiền sử điền sẵn từ khai báo, giáo viên sửa được.
 */
export function ExamAdminStep({ form, set, errors, child, campaign, dateRange, disabled }) {
  const a = form.exam.admin;
  const h = form.exam.history;
  const premature = a.premature
    ? `${PREMATURE_LABELS[a.premature]}${a.premature === YES_NO.YES && a.gestationWeeks ? ` · ${a.gestationWeeks} tuần` : ''}`
    : '';
  const pickGuardian = (g, index) =>
    set('exam.admin.companion', {
      guardianIndex: index,
      fullName: g.fullName,
      relation: GUARDIAN_TO_COMPANION_RELATION[g.relation] || 'Khác',
      phone: g.phone,
      idNumber: g.idNumber || '',
    });
  const picked = a.hasCompanion === YES_NO.YES && Number.isInteger(a.companion.guardianIndex);

  return (
    <>
      <section className="card wizard-card">
        <h2 className="card__title mb-12">I. Thông tin hành chính</h2>
        {!disabled && (
          <div className="alert alert--info mb-16">
            <Info size={18} />
            <div>
              Hành chính lấy từ hồ sơ trẻ, không sửa ở phiếu khám; sai hoặc thiếu thì báo Hiệu trưởng hoặc Phó hiệu trưởng sửa ở hồ sơ trẻ.
              Tiền sử điền sẵn từ khai báo sức khỏe, hỏi lại người đi cùng; khi lưu kết luận, thay đổi được cập nhật vào khai báo sức khỏe
              của trẻ.
            </div>
          </div>
        )}
        <div className="mb-16">
          <SplitInfoList
            rows={[
              { key: 'name', label: 'Họ và tên', value: child.fullName.toUpperCase(), className: 'fw-600' },
              { key: 'dob', label: 'Ngày sinh', value: formatDate(child.dateOfBirth) },
              { key: 'gender', label: 'Giới', value: GENDER_LABELS[child.gender] || child.gender },
              { key: 'idNumber', label: PROFILE_FIELD_LABELS.idNumber, value: show(a.childIdNumber) },
              { key: 'premature', label: PROFILE_FIELD_LABELS.premature, value: show(premature) },
              { key: 'ethnicity', label: PROFILE_FIELD_LABELS.ethnicity, value: show(a.ethnicity) },
              { key: 'beneficiary', label: PROFILE_FIELD_LABELS.beneficiary, value: show(a.beneficiary) },
              { key: 'bloodType', label: PROFILE_FIELD_LABELS.bloodType, value: show(a.bloodType) },
              { key: 'address', label: PROFILE_FIELD_LABELS.address, value: show(formatAddress(a.address)) },
              { key: 'school', label: 'Cơ sở giáo dục', value: `${child.schoolName} · ${child.className}` },
              {
                key: 'examiner',
                label: 'Cơ sở kiểm tra sức khỏe',
                value: campaign.examiner || <span className="muted">Chưa cập nhật ở đợt khám</span>,
              },
            ]}
          />
        </div>
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
            {!disabled &&
              (child.guardians.length > 0 ? (
                <div className="mt-16">
                  <fieldset className="field tr-fieldset tr-exam-choice">
                    <legend className="field__label">
                      Chọn người đi cùng trong phụ huynh của hồ sơ<span className="req">*</span>
                    </legend>
                    <div className="row row--wrap gap-2">
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
                    {errors['exam.admin.companion'] ? (
                      <span className="field__error" role="alert">
                        {errors['exam.admin.companion']}
                      </span>
                    ) : (
                      <span className="field__hint">
                        Người đi cùng không có trong hồ sơ: báo Hiệu trưởng hoặc Phó hiệu trưởng thêm vào hồ sơ trẻ.
                      </span>
                    )}
                  </fieldset>
                </div>
              ) : (
                <p className="field__error mt-12" role="alert">
                  Hồ sơ trẻ chưa có phụ huynh. Báo Hiệu trưởng hoặc Phó hiệu trưởng bổ sung, hoặc chọn Không có người đi cùng.
                </p>
              ))}
            {(picked || disabled) && a.companion.fullName && (
              <dl className="info-list mt-12">
                <dt>Họ tên</dt>
                <dd className="fw-600">{a.companion.fullName}</dd>
                <dt>Mối quan hệ với trẻ</dt>
                <dd>{show(a.companion.relation)}</dd>
                <dt>Số điện thoại liên hệ</dt>
                <dd>{show(a.companion.phone)}</dd>
                <dt>Số CC/CCCD/Mã định danh</dt>
                <dd>{show(a.companion.idNumber)}</dd>
              </dl>
            )}
          </>
        )}
      </section>

      <section className="card wizard-card mt-16">
        <h2 className="card__title mb-12">Tiền sử</h2>
        <p className="muted text-sm mb-12">
          Hỏi người đi cùng trẻ. Ghi đúng tên bệnh người nhà báo, không tự ghi chẩn đoán. Lưu kết luận thì cập nhật vào khai báo sức khỏe
          của trẻ.
        </p>
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
