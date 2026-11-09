import { Notice } from '@/components/education-plan/eduUi';

export function sourceItemLabel(plan, item) {
  const objects = [
    ...(plan.themes || []),
    ...(plan.branchTemplates || []),
    ...(plan.domains || []).flatMap((d) => (d.rows || []).flatMap((r) => [r, ...(r.contents || [])])),
  ];
  const target = objects.find((object) => String(object.id) === String(item.itemId));
  return target?.text || target?.name || `${item.itemKind} #${item.itemId}`;
}

export default function TeamSourceReview({ plan, onResolve, busy = false }) {
  const items = plan.reviewItems || [];
  const newItems = plan.newItems || [];
  if (!items.length && !newItems.length) return null;
  const unresolved = items.filter((item) => !item.resolved);
  return (
    <div className="stack mt-16">
      {items.length > 0 && (
        <Notice tone={unresolved.length ? 'err' : 'ok'}>
          <strong>
            {unresolved.length ? `Còn ${unresolved.length} mục cần rà soát trước khi gửi duyệt` : 'Đã rà soát các thay đổi của nguồn'}
          </strong>
          <ul className="stack">
            {items.map((item) => (
              <li key={item.reviewItemId} className="row row--between row--wrap gap-2">
                <span>
                  <strong>{sourceItemLabel(plan, item)}</strong>: {item.reason} · {item.resolved ? 'Đã kiểm tra' : 'Cần rà soát'}
                </span>
                {!item.resolved && onResolve && (
                  <button type="button" className="btn btn--sm" disabled={busy} onClick={() => onResolve(item)}>
                    Đã sửa liên kết, xác nhận kiểm tra
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!!onResolve && <p>Lưu dấu tích đã sửa trước khi xác nhận. Máy chủ kiểm tra liên kết theo nguồn hiện tại.</p>}
        </Notice>
      )}
      {newItems.length > 0 && (
        <Notice>
          <strong>Mục mới từ nguồn năm học — chọn nội dung phù hợp để phân bổ</strong>
          <ul>
            {newItems.map((item) => (
              <li key={`${item.itemKind}-${item.itemId}`}>Mới: {sourceItemLabel(plan, item)}</li>
            ))}
          </ul>
        </Notice>
      )}
    </div>
  );
}

export function SourceItemMark({ itemKind, itemId, reviewItems = [], newItems = [] }) {
  const review = reviewItems.find((item) => item.itemKind === itemKind && String(item.itemId) === String(itemId) && !item.resolved);
  if (review)
    return (
      <div className="text-danger text-xs" role="note">
        Cần rà soát: {review.reason}
      </div>
    );
  if (newItems.some((item) => item.itemKind === itemKind && String(item.itemId) === String(itemId)))
    return (
      <div className="text-primary text-xs" role="note">
        Mới từ nguồn năm học
      </div>
    );
  return null;
}
