import { useState } from 'react';
import { AlertTriangle, Eye } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/utils/format';

export function AllergyMenuChanges({ changes = [], date, context }) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = changes.find((c) => c.id === selectedId);
  if (!changes.length) return null;

  return (
    <div className="kb-menu-changes">
      {changes.map((change) => (
        <div className="kb-menu-change" key={change.id}>
          <div className="kb-menu-change__title">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Thay đổi cho trẻ dị ứng</span>
          </div>
          {change.replacements.length ? (
            <ul className="kb-menu-change__dishes">
              {change.replacements.map((r, i) => (
                <li key={`${r.originalDish.id}_${i}`}>
                  {r.replacementDish ? (
                    <>
                      Thay <strong>{r.originalDish.name}</strong> bằng <strong>{r.replacementDish.name}</strong>
                    </>
                  ) : (
                    <>
                      Bỏ món <strong>{r.originalDish.name}</strong>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div>
              {!!change.removedDishes?.length && (
                <div>
                  Món không dùng: <strong>{change.removedDishes.map((d) => d.name).join(', ')}</strong>
                </div>
              )}
              {!!change.addedDishes?.length && (
                <div>
                  Món thay thế: <strong>{change.addedDishes.map((d) => d.name).join(', ')}</strong>
                </div>
              )}
              <div className="text-xs muted">Dữ liệu cũ chưa ghi cặp thay món cụ thể.</div>
            </div>
          )}
          <div className="kb-menu-change__meta">
            <span>{change.restrictions.length ? `Lý do: dị ứng ${change.restrictions.join(', ')}` : 'Chưa ghi lý do dị ứng'}</span>
            {change.childrenAvailable ? (
              <button
                type="button"
                className="btn btn--sm"
                aria-label={`Xem trẻ cần suất thay thế: ${change.restrictions.join(', ')}`}
                title="Xem tên trẻ, lớp và chất dị ứng"
                onClick={() => setSelectedId(change.id)}
              >
                <Eye size={16} aria-hidden="true" />
                {change.childCount} trẻ / {change.classCount} lớp
              </button>
            ) : (
              <span>Chưa có danh sách trẻ theo điểm trường.</span>
            )}
          </div>
          {change.note && <div className="text-xs muted">Hướng dẫn: {change.note}</div>}
        </div>
      ))}
      <Modal
        open={!!selected}
        title="Trẻ cần suất thay thế"
        onClose={() => setSelectedId(null)}
        footer={
          <button type="button" className="btn" onClick={() => setSelectedId(null)}>
            Đóng
          </button>
        }
      >
        {selected && (
          <>
            <p className="text-sm muted">
              {context} · {formatDate(date)}
            </p>
            <p>
              Dị ứng: <strong>{selected.restrictions.join(', ') || 'Chưa ghi nhận'}</strong>
            </p>
            <p className="text-sm">
              {selected.childCount} trẻ / {selected.classCount} lớp trong điểm trường đang xem. Danh sách dị ứng không phải số suất ăn đã
              chốt.
            </p>
            {selected.children.length ? (
              <div className="table-wrap">
                <table className="table table--grid table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Tên trẻ</th>
                      <th scope="col">Lớp</th>
                      <th scope="col">Chất dị ứng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.children.map((child) => (
                      <tr key={child.id}>
                        <td>{child.fullName}</td>
                        <td>{child.className}</td>
                        <td>{child.allergies.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Chưa ghi nhận trẻ phù hợp với lý do dị ứng này trong nhóm tuổi và điểm trường đang xem.</p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
