import { childNameWithHistory } from '@/utils/childHistory';
import { ChildAvatar } from '@/components/ChildAvatar';

/** Ô tên trẻ trong bảng/danh sách đánh giá: avatar + họ tên (+ mã hoặc dòng phụ). */
export function ChildNameCell({ child, sub, size = 'sm' }) {
  const subText = sub === undefined ? child?.code : sub;
  return (
    <div className="dg-child-cell">
      <ChildAvatar child={child} size={size} />
      <div>
        <div className="fw-600">{childNameWithHistory(child?.fullName || '—', child?.historyStatus)}</div>
        {subText && <div className="muted text-xs">{subText}</div>}
      </div>
    </div>
  );
}

/** Dòng đánh giá / đề xuất chỉ có childName, childCode, childPhotoUrl ⇒ dạng child cho ChildNameCell. */
export const childOfRow = (row) => ({
  childId: row.childId,
  fullName: row.childName,
  code: row.childCode,
  historyStatus: row.historyStatus,
  photoUrl: row.childPhotoUrl,
});
