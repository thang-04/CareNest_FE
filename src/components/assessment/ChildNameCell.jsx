import { ChildAvatar } from '@/components/ChildAvatar';

/** Ô tên trẻ trong bảng/danh sách đánh giá: avatar + họ tên (+ mã hoặc dòng phụ). */
export function ChildNameCell({ child, sub, size = 'sm' }) {
  const subText = sub === undefined ? child?.code : sub;
  return (
    <div className="dg-child-cell">
      <ChildAvatar child={child} size={size} />
      <div>
        <div className="fw-600">{child?.fullName || '—'}</div>
        {subText && <div className="muted text-xs">{subText}</div>}
      </div>
    </div>
  );
}

/** Dòng đánh giá / đề xuất chỉ có childName, childCode, childPhotoUrl ⇒ dạng child cho ChildNameCell. */
export const childOfRow = (row) => ({ fullName: row.childName, code: row.childCode, photoUrl: row.childPhotoUrl });
