import { ALLERGY_STATE_LABELS, DECLARATION_STATE, DIET_STATE_LABELS, NOTE_STATE_LABELS } from '@/models/children/childrenConstants';
import { formatDateTime } from '@/utils/format';

/** Read-only health declaration. Allergies saved by the Vice Principal are the official list used by the kitchen. */
export function DeclarationSummary({ declaration }) {
  if (!declaration) return <p className="muted">Chưa có khai báo sức khỏe khi tiếp nhận.</p>;
  const { allergies, diet, otherNotes, declaredAt, declaredByName } = declaration;
  const reported = allergies.state === DECLARATION_STATE.REPORTED;
  return (
    <dl className="info-list info-list--wide">
      <dt>Dị ứng</dt>
      <dd>
        <div>{ALLERGY_STATE_LABELS[allergies.state]}</div>
        {reported && (
          <div className="row row--wrap mt-8" style={{ gap: 6 }}>
            {allergies.items.map((x) => (
              <span key={x} className="chip chip--red">
                {x}
              </span>
            ))}
          </div>
        )}
      </dd>
      <dt>Chế độ ăn</dt>
      <dd>{diet.state === DECLARATION_STATE.REPORTED ? diet.text : DIET_STATE_LABELS[diet.state]}</dd>
      <dt>Thông tin khác</dt>
      <dd>{otherNotes?.state === DECLARATION_STATE.REPORTED ? otherNotes.text : NOTE_STATE_LABELS[otherNotes?.state || 'NOT_PROVIDED']}</dd>
      {declaredAt && (
        <>
          <dt>Người chốt</dt>
          <dd>
            {declaredByName || '—'} · {formatDateTime(declaredAt)}
          </dd>
        </>
      )}
    </dl>
  );
}
