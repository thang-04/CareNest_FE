import { ChildAvatar } from '@/components/ChildAvatar';
import { GENDER_LABELS, ageLabel } from '@/models/School';
import { formatDate } from '@/utils/format';

/** Thẻ trẻ đang thao tác: ảnh, tên, ngày sinh, tuổi, giới tính. child: { fullName, photoUrl, dateOfBirth, gender }. */
export function ChildBrief({ child }) {
  const gender = GENDER_LABELS[child.gender];
  return (
    <div className="tr-child-brief">
      <ChildAvatar child={child} size="lg" />
      <span className="stack gap-0">
        <span className="fw-600">{child.fullName}</span>
        <span className="muted text-xs">
          {formatDate(child.dateOfBirth)} · {ageLabel(child.dateOfBirth)}
          {gender ? ` · ${gender}` : ''}
        </span>
      </span>
    </div>
  );
}

/** Đầu thẻ: tên phần bên trái, trẻ đang thao tác bên phải để làm đúng trẻ (tiếp nhận bước 2–4, sửa khai báo sức khỏe). */
export function ChildCardHead({ title, child }) {
  return (
    <div className="tr-step-head">
      <h2 className="card__title">{title}</h2>
      {child && <ChildBrief child={child} />}
    </div>
  );
}
