import { AllergyStateBadge, DietStateBadge, NoteStateBadge } from '@/components/children/ChildBadges';
import { DECLARATION_STATE } from '@/models/children/childrenConstants';
import { MEDICAL_HISTORY_ITEMS, historyItemText } from '@/models/children/childProfile';
import { formatDateTime } from '@/utils/format';
import { EmptyState } from '@/components/ui/States';
import { IntakeSheet, IntakeSheetValueRow } from './IntakeSheet';

/**
 * Read-only health declaration. Allergies saved by the Vice Principal are the official list used by the kitchen.
 * sheet: một bảng TT | nội dung | giá trị (bước Xem lại khi tiếp nhận, title = dải phần); mặc định hai bảng như form sửa
 * (I. Dị ứng và chế độ ăn | II. Tiền sử và sức khỏe khác), Báo ăn và người chốt ở dòng trên (màn Khai báo sức khỏe, user duyệt 19/11/2026).
 */
export function DeclarationSummary({
  declaration,
  sheet = false,
  title = 'Khai báo sức khỏe',
  mealRegistered = declaration?.mealRegistered ?? true,
}) {
  if (!declaration)
    return (
      <EmptyState title="Chưa có khai báo sức khỏe" description="Khai báo dị ứng, chế độ ăn và tiền sử bệnh khi tiếp nhận sẽ hiện ở đây." />
    );
  const { allergies, diet, otherNotes, medicalHistory, declaredAt, declaredByName } = declaration;
  const reported = allergies.state === DECLARATION_STATE.REPORTED;
  // CHD-13: chỉ false mới là không báo ăn (null/thiếu = báo ăn); không báo ăn thì ẩn dị ứng và chế độ ăn.
  const eats = mealRegistered !== false;
  const allergyValue = (
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
    </>
  );
  const dietValue = diet.state === DECLARATION_STATE.REPORTED ? diet.text : <DietStateBadge status={diet.state} />;
  const historyRows = MEDICAL_HISTORY_ITEMS.map((it) => [it.label, historyItemText(it, medicalHistory)]);
  const otherValue =
    otherNotes?.state === DECLARATION_STATE.REPORTED ? (
      otherNotes.text
    ) : (
      <NoteStateBadge status={otherNotes?.state || DECLARATION_STATE.NOT_PROVIDED} />
    );

  if (sheet) {
    const rows = [
      ['Báo ăn', eats ? 'Có' : 'Không'],
      ...(eats
        ? [
            ['Dị ứng', allergyValue],
            ['Chế độ ăn', dietValue],
          ]
        : []),
      ...historyRows,
      ['Thông tin khác', otherValue],
      ...(declaredAt ? [['Người chốt', `${declaredByName || '—'} · ${formatDateTime(declaredAt)}`]] : []),
    ];
    return (
      <IntakeSheet title={title}>
        {rows.map(([label, v]) => (
          <IntakeSheetValueRow key={label} label={label}>
            {v}
          </IntakeSheetValueRow>
        ))}
      </IntakeSheet>
    );
  }

  return (
    <div className="tr-intake stack gap-5">
      <dl className="tr-decl-meta">
        <div>
          <dt>Báo ăn</dt>
          <dd className="fw-600">{eats ? 'Có' : 'Không'}</dd>
        </div>
        {declaredAt && (
          <div>
            <dt>Người chốt</dt>
            <dd>
              <span className="fw-600">{declaredByName || '—'}</span> · {formatDateTime(declaredAt)}
            </dd>
          </div>
        )}
      </dl>
      <div className="tr-intake-cols">
        {eats && (
          <section aria-label="Dị ứng và chế độ ăn">
            <IntakeSheet title="I. Dị ứng và chế độ ăn">
              <IntakeSheetValueRow label="Dị ứng thực phẩm / thuốc">{allergyValue}</IntakeSheetValueRow>
              <IntakeSheetValueRow label="Chế độ ăn">{dietValue}</IntakeSheetValueRow>
            </IntakeSheet>
          </section>
        )}
        <section aria-label="Tiền sử và sức khỏe khác">
          <IntakeSheet title={`${eats ? 'II' : 'I'}. Tiền sử và sức khỏe khác`}>
            {historyRows.map(([label, v]) => (
              <IntakeSheetValueRow key={label} label={label}>
                {v}
              </IntakeSheetValueRow>
            ))}
            <IntakeSheetValueRow label="Thông tin sức khỏe khác">{otherValue}</IntakeSheetValueRow>
          </IntakeSheet>
        </section>
      </div>
    </div>
  );
}
