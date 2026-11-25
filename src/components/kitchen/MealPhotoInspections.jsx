import { InspectionStateBadge } from '@/components/kitchen/KitchenBadges';
import { INSPECTION_TAB_LABELS } from '@/models/kitchen/inspectionConstants';
import { formatDateTime } from '@/utils/format';

/** Biên bản kiểm thực của ngày: mẫu nào đã ký, ai ký, lúc nào; mẫu chưa có biên bản thì không có dòng. */
export function MealPhotoInspections({ inspections }) {
  return (
    <section className="card" aria-label="Biên bản kiểm thực">
      <div className="card__header">
        <h2 className="card__title">Biên bản kiểm thực</h2>
      </div>
      <div className="card__body">
        {inspections.length ? (
          <ul className="kr-dishes">
            {inspections.map((item) => (
              <li key={item.tab}>
                <strong>{INSPECTION_TAB_LABELS[String(item.tab).toLowerCase()] || item.tab}</strong>{' '}
                <InspectionStateBadge status={item.status} />
                {item.signedByName && (
                  <span className="text-xs muted">
                    {' '}
                    · {item.signedByName}, {formatDateTime(item.signedAt)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm muted">Ngày này chưa có biên bản kiểm thực nào.</p>
        )}
      </div>
    </section>
  );
}
