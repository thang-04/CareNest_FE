import { PREMATURE_LABELS, PROFILE_FIELD_LABELS, formatAddress, hasProfileData } from '@/models/children/childProfile';
import { IntakeSheet, IntakeSheetValueRow } from './IntakeSheet';

/**
 * Thông tin hành chính chỉ xem (bước Xem lại khi tiếp nhận, hồ sơ trẻ). Ô trống hiện "Chưa cung cấp". Tuần thai hiện cho mọi
 * trẻ, dòng riêng như phần I phiếu khám (user chốt 2026-11-04).
 * sheet: bảng TT | nội dung | giá trị như bước 1 tiếp nhận (title = dải phần).
 */
export function ChildProfileSummary({ profile, sheet = false, title = 'Thông tin hành chính' }) {
  const missing = <span className="muted">Chưa cung cấp</span>;
  const show = (v) => (v === '' || v == null ? missing : v);
  const weeks = profile?.gestationWeeks;
  const rows = profile
    ? [
        [PROFILE_FIELD_LABELS.idNumber, show(profile.idNumber)],
        [PROFILE_FIELD_LABELS.premature, show(profile.premature ? PREMATURE_LABELS[profile.premature] : '')],
        [PROFILE_FIELD_LABELS.gestationWeeks, show(weeks === '' || weeks == null ? '' : `${weeks} tuần`)],
        [PROFILE_FIELD_LABELS.ethnicity, show(profile.ethnicity)],
        [PROFILE_FIELD_LABELS.beneficiary, show(profile.beneficiary)],
        [PROFILE_FIELD_LABELS.bloodType, show(profile.bloodType)],
        [PROFILE_FIELD_LABELS.address, show(formatAddress(profile.address))],
      ]
    : [];

  if (sheet)
    return (
      <IntakeSheet title={title}>
        {rows.map(([label, v]) => (
          <IntakeSheetValueRow key={label} label={label}>
            {v}
          </IntakeSheetValueRow>
        ))}
      </IntakeSheet>
    );

  if (!hasProfileData(profile)) return <p className="muted">Chưa cung cấp. Hiệu trưởng hoặc Phó hiệu trưởng bổ sung ở Sửa hồ sơ.</p>;
  return (
    <dl className="info-list info-list--wide">
      {rows.map(([label, v]) => (
        <div key={label} className="tr-dl-pair">
          <dt>{label}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
