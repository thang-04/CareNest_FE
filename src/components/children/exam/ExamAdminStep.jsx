import { useId } from 'react';
import { UserCheck } from '@/components/ui/icons';
import { GENDER_LABELS } from '@/models/School';
import { COMPANION_OPTIONS, EXAM_STEPS, GUARDIAN_TO_COMPANION_RELATION, HISTORY_ITEMS, YES_NO } from '@/models/children/healthExamForm';
import { PREMATURE_LABELS, PROFILE_FIELD_LABELS, formatAddress } from '@/models/children/childProfile';
import { formatDate, todayInput } from '@/utils/format';
import {
  EXAM_SECTIONS,
  ExamSheetBand,
  ExamSheetCard,
  ExamSheetChoiceCell,
  ExamSheetDetail,
  ExamSheetInputCell,
  ExamSheetRows,
  ExamSheetTable,
} from './ExamFields';

const missing = <span className="muted">Chưa cung cấp</span>;

/**
 * Dòng phần I lấy từ hồ sơ trẻ (chỉ xem), mỗi thông tin một dòng; dùng chung cho form và trang xem phiếu. dateCell: ô ngày kiểm
 * tra (ô nhập ở form, chữ ở trang xem); blank: chữ khi hồ sơ để trống.
 */
export const profileRows = ({ child, admin: a, campaign, dateLabelId, dateRequired, dateCell, blank = missing, examinerBlank = blank }) => {
  const show = (v) => (v === '' || v == null ? blank : v);
  const text = (key, label, value, className) => ({ key, label, cell: <td className={className}>{show(value)}</td> });
  return [
    text('name', 'Họ và tên', child.fullName.toUpperCase(), 'fw-600'),
    text('dob', 'Ngày sinh', formatDate(child.dateOfBirth)),
    text('gender', 'Giới', GENDER_LABELS[child.gender] || child.gender),
    text('idNumber', PROFILE_FIELD_LABELS.idNumber, a.childIdNumber),
    text('premature', PROFILE_FIELD_LABELS.premature, a.premature ? PREMATURE_LABELS[a.premature] : ''),
    text(
      'gestationWeeks',
      PROFILE_FIELD_LABELS.gestationWeeks,
      a.gestationWeeks === '' || a.gestationWeeks == null ? '' : `${a.gestationWeeks} tuần`,
    ),
    text('ethnicity', PROFILE_FIELD_LABELS.ethnicity, a.ethnicity),
    text('beneficiary', PROFILE_FIELD_LABELS.beneficiary, a.beneficiary),
    text('bloodType', PROFILE_FIELD_LABELS.bloodType, a.bloodType),
    text('school', 'Cơ sở giáo dục', `${child.schoolName} · ${child.className}`),
    text('address', PROFILE_FIELD_LABELS.address, formatAddress(a.address)),
    { key: 'date', label: 'Ngày kiểm tra sức khỏe', id: dateLabelId, required: dateRequired, cell: dateCell },
    { key: 'examiner', label: 'Cơ sở kiểm tra sức khỏe', cell: <td>{campaign.examiner || examinerBlank}</td> },
  ];
};

/**
 * Bước 1 — Phần I (user chốt 2026-10-22). Hành chính lấy từ hồ sơ trẻ, chỉ xem; Hiệu trưởng, Phó hiệu trưởng sửa ở hồ sơ.
 * Giáo viên nhập ngày khám, chọn người đi cùng trong phụ huynh của hồ sơ; tiền sử điền sẵn từ khai báo, giáo viên sửa được.
 */
export function ExamAdminStep({ form, set, errors, child, campaign, dateRange, disabled }) {
  const uid = useId();
  const id = (key) => `${uid}-${key}`;
  const a = form.exam.admin;
  const h = form.exam.history;
  const pickGuardian = (g, index) =>
    set('exam.admin.companion', {
      guardianIndex: index,
      fullName: g.fullName,
      relation: GUARDIAN_TO_COMPANION_RELATION[g.relation] || 'Khác',
      phone: g.phone,
      idNumber: g.idNumber || '',
    });
  const withCompanion = a.hasCompanion === YES_NO.YES;
  const picked = withCompanion && Number.isInteger(a.companion.guardianIndex);
  const showCompanion = withCompanion && (picked || disabled) && a.companion.fullName;
  const show = (v) => (v === '' || v == null ? missing : v);

  const companionRows = [
    {
      key: 'hasCompanion',
      label: 'Có người đi cùng trẻ khi khám',
      id: id('hasCompanion'),
      required: true,
      cell: (
        <ExamSheetChoiceCell
          name="hasCompanion"
          labelledBy={id('hasCompanion')}
          options={COMPANION_OPTIONS}
          value={a.hasCompanion}
          onChange={(v) => set('exam.admin.hasCompanion', v)}
          error={errors['exam.admin.hasCompanion']}
          disabled={disabled}
        />
      ),
    },
    withCompanion &&
      !disabled && {
        key: 'guardian',
        label: 'Chọn người đi cùng trong phụ huynh của hồ sơ',
        id: id('guardian'),
        required: true,
        cell: (
          <td>
            {child.guardians.length > 0 ? (
              <>
                <fieldset className="tr-fieldset" aria-labelledby={id('guardian')}>
                  <div className="row row--wrap gap-2 tr-exam-sheet__pick">
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
                </fieldset>
                {errors['exam.admin.companion'] ? (
                  <span className="field__error" role="alert">
                    {errors['exam.admin.companion']}
                  </span>
                ) : (
                  <span className="field__hint">
                    Người đi cùng không có trong hồ sơ: báo Hiệu trưởng hoặc Phó hiệu trưởng thêm vào hồ sơ trẻ.
                  </span>
                )}
              </>
            ) : (
              <span className="field__error" role="alert">
                Hồ sơ trẻ chưa có phụ huynh. Báo Hiệu trưởng hoặc Phó hiệu trưởng bổ sung, hoặc chọn Không có người đi cùng.
              </span>
            )}
          </td>
        ),
      },
    showCompanion && { key: 'companionName', label: 'Họ tên', cell: <td className="fw-600">{a.companion.fullName}</td> },
    showCompanion && { key: 'companionRelation', label: 'Mối quan hệ với trẻ', cell: <td>{show(a.companion.relation)}</td> },
    showCompanion && { key: 'companionPhone', label: 'Số điện thoại liên hệ', cell: <td>{show(a.companion.phone)}</td> },
    showCompanion && { key: 'companionId', label: 'Số CC/CCCD/Mã định danh', cell: <td>{show(a.companion.idNumber)}</td> },
  ];

  const historyRows = HISTORY_ITEMS.map((item) => {
    const yes = h[item.key] === YES_NO.YES;
    return {
      key: item.key,
      label: item.label,
      id: id(item.key),
      required: true,
      cell: (
        <ExamSheetChoiceCell
          name={`history-${item.key}`}
          labelledBy={id(item.key)}
          options={item.options}
          value={h[item.key]}
          onChange={(v) => set(`exam.history.${item.key}`, v)}
          error={errors[`exam.history.${item.key}`]}
          disabled={disabled}
        >
          {yes && item.textKey && (
            <ExamSheetDetail
              label={item.textLabel}
              required
              size="short"
              maxLength={300}
              value={h[item.textKey]}
              onChange={(v) => set(`exam.history.${item.textKey}`, v)}
              error={errors[`exam.history.${item.textKey}`]}
              disabled={disabled}
            />
          )}
          {yes && item.dateKey && (
            <ExamSheetDetail
              type="date"
              size="date"
              label={item.dateLabel}
              required
              value={h[item.dateKey] || ''}
              min={child.dateOfBirth}
              max={form.date && form.date < todayInput() ? form.date : todayInput()}
              onChange={(v) => set(`exam.history.${item.dateKey}`, v)}
              error={errors[`exam.history.${item.dateKey}`]}
              disabled={disabled}
            />
          )}
        </ExamSheetChoiceCell>
      ),
    };
  });

  return (
    <ExamSheetCard
      title={EXAM_STEPS[0].label}
      info={
        !disabled &&
        'Hành chính lấy từ hồ sơ trẻ, không sửa ở phiếu khám; sai hoặc thiếu thì báo Hiệu trưởng hoặc Phó hiệu trưởng sửa ở hồ sơ trẻ. Tiền sử điền sẵn từ khai báo sức khỏe: hỏi lại người đi cùng, ghi đúng tên bệnh người nhà báo, không tự ghi chẩn đoán.'
      }
      note="Có người đi cùng: bác sĩ trao đổi kết luận tại buổi khám, hệ thống ghi lại lần trao đổi này. Lưu kết luận thì tiền sử được cập nhật vào khai báo sức khỏe của trẻ; đổi ngày tiếp xúc lao thì hệ thống báo Hiệu trưởng, Phó hiệu trưởng điểm trường."
    >
      <ExamSheetTable label={EXAM_SECTIONS.admin}>
        <ExamSheetBand primary>{EXAM_SECTIONS.admin}</ExamSheetBand>
        <ExamSheetRows
          rows={profileRows({
            child,
            admin: a,
            campaign,
            dateLabelId: id('date'),
            dateRequired: true,
            examinerBlank: <span className="muted">Chưa cập nhật ở đợt khám</span>,
            dateCell: (
              <ExamSheetInputCell
                type="date"
                size="date"
                labelledBy={id('date')}
                value={form.date}
                min={dateRange.min}
                max={dateRange.max}
                error={errors.date}
                disabled={disabled}
                onChange={(v) => set('date', v)}
              />
            ),
          })}
        />
        <ExamSheetBand>Người đi cùng trẻ</ExamSheetBand>
        <ExamSheetRows rows={companionRows} />
        <ExamSheetBand>Tiền sử</ExamSheetBand>
        <ExamSheetRows rows={historyRows} />
      </ExamSheetTable>
    </ExamSheetCard>
  );
}
