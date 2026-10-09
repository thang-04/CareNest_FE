import { ShieldCheck, Clock } from '@/components/ui/icons';
import { ALLERGY_STATE_LABELS, DECLARATION_STATE, DIET_STATE_LABELS, NOTE_STATE_LABELS } from '@/models/children/childrenConstants';
import { formatDateTime } from '@/utils/format';

const missing = <span className="muted">Chưa có thông tin</span>;

/** Read-only enrollment health declaration. confirmedAllergies = official list on the child (GBR-HLT-03). */
export function DeclarationSummary({ declaration, confirmedAllergies = [], confirmedByName }) {
  if (!declaration) return <p className="muted">Chưa có khai báo sức khỏe khi tiếp nhận.</p>;
  const { allergies, diet, otherNotes, allergyConfirmation } = declaration;
  const reported = allergies.state === DECLARATION_STATE.REPORTED;
  return (
    <dl className="info-list info-list--wide">
      <dt>Dị ứng (khai báo)</dt>
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
      <dt>Xác nhận dị ứng</dt>
      <dd>
        {allergies.state === DECLARATION_STATE.NOT_PROVIDED ? (
          missing
        ) : allergyConfirmation ? (
          <span className="text-success row" style={{ gap: 6 }}>
            <ShieldCheck size={16} /> Hiệu trưởng {confirmedByName ? `${confirmedByName} ` : ''}đã xác nhận{' '}
            {formatDateTime(allergyConfirmation.at)}
          </span>
        ) : (
          <span className="chip chip--orange">
            <Clock size={14} /> Chờ Hiệu trưởng xác nhận
          </span>
        )}
        {allergyConfirmation && confirmedAllergies.length > 0 && (
          <div className="muted text-sm mt-8">Danh sách dùng cho bếp: {confirmedAllergies.join(', ')}</div>
        )}
      </dd>
      <dt>Chế độ ăn</dt>
      <dd>{diet.state === DECLARATION_STATE.REPORTED ? diet.text : DIET_STATE_LABELS[diet.state]}</dd>
      <dt>Thông tin khác</dt>
      <dd>{otherNotes?.state === DECLARATION_STATE.REPORTED ? otherNotes.text : NOTE_STATE_LABELS[otherNotes?.state || 'NOT_PROVIDED']}</dd>
    </dl>
  );
}
