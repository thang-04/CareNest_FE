import { AllergyStateBadge, DietStateBadge, NoteStateBadge } from '@/components/children/ChildBadges';
import { DECLARATION_STATE } from '@/models/children/childrenConstants';
import { MEDICAL_HISTORY_ITEMS, historyItemText } from '@/models/children/childProfile';
import { formatDateTime } from '@/utils/format';
import { EmptyState } from '@/components/ui/States';

/** Read-only health declaration. Allergies saved by the Vice Principal are the official list used by the kitchen. */
export function DeclarationSummary({ declaration }) {
  if (!declaration)
    return (
      <EmptyState title="Chưa có khai báo sức khỏe" description="Khai báo dị ứng, chế độ ăn và tiền sử bệnh khi tiếp nhận sẽ hiện ở đây." />
    );
  const { allergies, diet, otherNotes, medicalHistory, declaredAt, declaredByName } = declaration;
  const reported = allergies.state === DECLARATION_STATE.REPORTED;
  return (
    <dl className="info-list info-list--wide">
      <dt>Dị ứng</dt>
      <dd>
        <div>
          <AllergyStateBadge status={allergies.state} />
        </div>
        {reported && (
          <div className="row row--wrap mt-8 gap-1-5">
            {allergies.items.map((x) => (
              <span key={x} className="chip chip--red">
                {x}
              </span>
            ))}
          </div>
        )}
      </dd>
      <dt>Chế độ ăn</dt>
      <dd>{diet.state === DECLARATION_STATE.REPORTED ? diet.text : <DietStateBadge status={diet.state} />}</dd>
      <dt>Thông tin khác</dt>
      <dd>
        {otherNotes?.state === DECLARATION_STATE.REPORTED ? (
          otherNotes.text
        ) : (
          <NoteStateBadge status={otherNotes?.state || DECLARATION_STATE.NOT_PROVIDED} />
        )}
      </dd>
      {MEDICAL_HISTORY_ITEMS.map((it) => (
        <div key={it.key} className="tr-dl-pair">
          <dt>{it.label}</dt>
          <dd>{historyItemText(it, medicalHistory)}</dd>
        </div>
      ))}
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
