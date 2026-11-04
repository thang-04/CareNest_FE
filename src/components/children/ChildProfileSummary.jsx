import { PREMATURE_LABELS, PROFILE_FIELD_LABELS, formatAddress, hasProfileData } from '@/models/children/childProfile';

/** Thông tin hành chính chỉ xem (bước Xem lại khi tiếp nhận, hồ sơ trẻ). Ô trống hiện "Chưa cung cấp". */
export function ChildProfileSummary({ profile }) {
  if (!hasProfileData(profile)) return <p className="muted">Chưa cung cấp. Hiệu trưởng hoặc Phó hiệu trưởng bổ sung ở Sửa hồ sơ.</p>;
  const missing = <span className="muted">Chưa cung cấp</span>;
  const show = (v) => (v === '' || v == null ? missing : v);
  const premature = profile.premature
    ? `${PREMATURE_LABELS[profile.premature]}${profile.premature === 'YES' && profile.gestationWeeks ? ` · ${profile.gestationWeeks} tuần` : ''}`
    : '';
  return (
    <dl className="info-list info-list--wide">
      <dt>{PROFILE_FIELD_LABELS.idNumber}</dt>
      <dd>{show(profile.idNumber)}</dd>
      <dt>{PROFILE_FIELD_LABELS.premature}</dt>
      <dd>{show(premature)}</dd>
      <dt>{PROFILE_FIELD_LABELS.ethnicity}</dt>
      <dd>{show(profile.ethnicity)}</dd>
      <dt>{PROFILE_FIELD_LABELS.beneficiary}</dt>
      <dd>{show(profile.beneficiary)}</dd>
      <dt>{PROFILE_FIELD_LABELS.bloodType}</dt>
      <dd>{show(profile.bloodType)}</dd>
      <dt>{PROFILE_FIELD_LABELS.address}</dt>
      <dd>{show(formatAddress(profile.address))}</dd>
    </dl>
  );
}
