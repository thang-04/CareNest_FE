import { AllergyStateBadge, DietStateBadge, NoteStateBadge } from '@/components/children/ChildBadges';
import { DECLARATION_STATE } from '@/models/children/childrenConstants';
import { MEDICAL_HISTORY_ITEMS, historyItemText } from '@/models/children/childProfile';
import { formatDateTime } from '@/utils/format';
import { IntakeSheet, IntakeSheetValueRow } from './IntakeSheet';

/**
 * Read-only health declaration. Allergies saved by the Vice Principal are the official list used by the kitchen.
 * sheet: bảng TT | nội dung | giá trị như bước 1 tiếp nhận (title = dải phần).
 */
export function DeclarationSummary({ declaration, sheet = false, title = 'Khai báo sức khỏe' }) {
  if (!declaration) return <p className="muted">Chưa có khai báo sức khỏe khi tiếp nhận.</p>;
  const { allergies, diet, otherNotes, medicalHistory, declaredAt, declaredByName } = declaration;
  const reported = allergies.state === DECLARATION_STATE.REPORTED;
  const rows = [
    [
      'Dị ứng',
      <>
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
      </>,
    ],
    ['Chế độ ăn', diet.state === DECLARATION_STATE.REPORTED ? diet.text : <DietStateBadge status={diet.state} />],
    [
      'Thông tin khác',
      otherNotes?.state === DECLARATION_STATE.REPORTED ? (
        otherNotes.text
      ) : (
        <NoteStateBadge status={otherNotes?.state || DECLARATION_STATE.NOT_PROVIDED} />
      ),
    ],
    ...MEDICAL_HISTORY_ITEMS.map((it) => [it.label, historyItemText(it, medicalHistory)]),
    ...(declaredAt ? [['Người chốt', `${declaredByName || '—'} · ${formatDateTime(declaredAt)}`]] : []),
  ];

  if (sheet)
    return (
      <IntakeSheet title={title}>
        {rows.map(([label, v]) => (
          <IntakeSheetValueRow key={label} label={label}>
            {v}
          </IntakeSheetValueRow>
        ))}
      </IntakeSheet>
    );

  return (
    <dl className="info-list info-list--wide">
      {rows.map(([label, v]) => (
        <div key={label} className="tr-dl-pair">
          <dt>{label}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
