import { InspectionStateBadge } from '@/components/kitchen/KitchenBadges';
import { INSPECTION_TAB_LABELS } from '@/models/kitchen/inspectionConstants';
import { formatTime } from '@/utils/format';

/** Biên bản kiểm thực của ngày: một dải chip mỗi mẫu (trạng thái, ai ký, lúc nào); mẫu chưa có biên bản thì không có chip. */
export function MealPhotoInspections({ inspections }) {
  return (
    <section className="card kr-insp" aria-label="Biên bản kiểm thực">
      <h2 className="kr-insp__title">Biên bản kiểm thực</h2>
      {inspections.length ? (
        inspections.map((item) => (
          <span className="kr-insp__item" key={item.tab}>
            <strong>{INSPECTION_TAB_LABELS[String(item.tab).toLowerCase()] || item.tab}</strong>
            <InspectionStateBadge status={item.status} />
            {item.signedByName && (
              <span className="text-xs muted">
                {item.signedByName} · {formatTime(item.signedAt)}
              </span>
            )}
          </span>
        ))
      ) : (
        <span className="text-sm muted">Ngày này chưa có biên bản nào.</span>
      )}
    </section>
  );
}
