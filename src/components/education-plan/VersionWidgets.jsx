import { Link } from 'react-router-dom';
import { Check, Copy, FileText, Trash2 } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, Notice, YearPlanStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { usePlanChanges } from '@/hooks/education-plan/usePlanChanges';
import { CHANGE, chainOf, currentPlanOf, unresolvedFlags, versionOf } from '@/models/education-plan/planVersions.mjs';

/*
 * Phiên bản kế hoạch năm và ô đỏ của tài liệu lớp (BE:EDU-25/26). Chỉ hiển thị; trạng thái, quyền và việc chặn gửi do
 * service quyết định. Màu đỏ dùng Notice tone err, nhãn đỏ và chữ lỗi có sẵn của UI kit.
 */

/** Nhãn phiên bản: Hiện hành / Đã thay thế / Đang soạn. */
export function VersionBadge({ plan, goals }) {
  const current = currentPlanOf(goals, plan.ageGroupId, plan.schoolYear);
  const label =
    plan.status !== 'APPROVED'
      ? `Phiên bản ${versionOf(plan)} · đang soạn`
      : current?.id === plan.id
        ? `Phiên bản ${versionOf(plan)} · hiện hành`
        : `Phiên bản ${versionOf(plan)} · đã thay thế`;
  const tone = plan.status !== 'APPROVED' ? 'purple' : current?.id === plan.id ? 'green' : 'gray';
  return <StatusBadge tone={tone} label={label} />;
}

const CHANGE_LABEL = { CHANGED: 'Đổi', REMOVED: 'Bỏ', ADDED: 'Mới' };
const CHANGE_TONE = { CHANGED: 'red', REMOVED: 'red', ADDED: 'blue' };

/** Trang chi tiết kế hoạch năm: lịch sử phiên bản (chỉ xem) và thay đổi so với phiên bản nguồn. */
export function YearPlanVersionPanel({ plan, goals }) {
  const chain = chainOf(goals, plan);
  const { data: changes, loading, error, reload } = usePlanChanges(plan.id, null, !!plan.sourcePlanId);
  const changed = [
    ...(changes?.goals || [])
      .filter((g) => g.change !== CHANGE.UNCHANGED)
      .map((g) => ({
        key: `g${g.lineageId}`,
        change: g.change,
        text:
          g.change === CHANGE.REMOVED
            ? `MT${g.fromGoalNo}: ${g.fromText}`
            : `MT${g.goalNo}: ${g.text}${g.change === CHANGE.CHANGED && !g.fields.includes('text') ? ' (nội dung giáo dục)' : ''}`,
      })),
    ...(changes?.themes || [])
      .filter((t) => t.change !== CHANGE.UNCHANGED)
      .map((t) => ({ key: `t${t.lineageId}`, change: t.change, text: `Chủ đề ${t.name || t.fromName}` })),
  ];
  return (
    <Card title="Phiên bản" className="mt-16">
      <div className="stack">
        {chain.length > 1 && (
          <ul className="stack">
            {chain.map((v) => (
              <li key={v.id} className="row row--wrap gap-2">
                {v.id === plan.id ? <strong>{v.code}</strong> : <Link to={`/education/goals/${v.id}`}>{v.code}</Link>}
                <VersionBadge plan={v} goals={goals} />
                <YearPlanStatusBadge status={v.status} />
                <span className="muted text-sm">
                  Tạo {fmtDate(v.createdAt)}
                  {v.createdBy ? ` · ${v.createdBy}` : ''}
                  {v.issued?.at ? ` · ban hành ${fmtDate(v.issued.at)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
        {plan.sourcePlanId && (
          <>
            <strong>Thay đổi so với phiên bản {versionOf(plan) - 1}</strong>
            {loading && <span className="muted">Đang so sánh…</span>}
            {error && (
              <Notice tone="err">
                Không tải được so sánh.{' '}
                <button type="button" className="btn btn--sm" onClick={() => reload()}>
                  Thử lại
                </button>
              </Notice>
            )}
            {changes && !changed.length && <span className="muted">Chưa có thay đổi.</span>}
            {changed.length > 0 && (
              <ul className="stack">
                {changed.map((c) => (
                  <li key={c.key} className="row gap-2">
                    <StatusBadge tone={CHANGE_TONE[c.change]} label={CHANGE_LABEL[c.change]} size="sm" />
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {chain.length <= 1 && !plan.sourcePlanId && <span className="muted">Phiên bản 1. Chưa có phiên bản điều chỉnh.</span>}
      </div>
    </Card>
  );
}

/**
 * Tài liệu chưa có trên phiên bản hiện hành mà có ở phiên bản trước: tạo từ bản mẫu hoặc chép bản cũ (FR-022).
 * busy: đang tạo; canCreate: giáo viên của lớp.
 */
export function VersionCopyOffer({ plan, previous, prevDoc, canCreate, busy, onTemplate, onCopy }) {
  return (
    <Notice tone="warn">
      <div className="stack">
        <span>
          Kế hoạch năm đã có phiên bản {versionOf(plan)} (ban hành thay phiên bản {versionOf(previous)}). Tài liệu cũ giữ nguyên để xem; tài
          liệu trên phiên bản mới cần lập lại và gửi duyệt lại.
        </span>
        {canCreate && (
          <div className="row row--wrap gap-2">
            <button type="button" className="btn btn--sm" disabled={busy} onClick={onTemplate}>
              <FileText size={16} aria-hidden /> Tạo từ bản mẫu
            </button>
            {prevDoc && (
              <button type="button" className="btn btn--outline-primary btn--sm" disabled={busy} onClick={onCopy}>
                <Copy size={16} aria-hidden /> Chép bản cũ và sửa ô đỏ
              </button>
            )}
          </div>
        )}
      </div>
    </Notice>
  );
}

/** Tài liệu thuộc phiên bản đã bị thay thế: chỉ xem (BE:EDU-26). */
export function SupersededNote({ doc }) {
  if (!doc?.superseded) return null;
  return (
    <Notice>
      Tài liệu theo kế hoạch năm phiên bản {doc.yearPlanVersion || 1}, đã có phiên bản mới. Bản này chỉ để xem, in; soạn tiếp trên phiên bản
      hiện hành.
    </Notice>
  );
}

/** Chủ đề đã kết thúc trước khi có phiên bản mới: chỉ ghi chú, không đỏ (FR-025). */
export function FinishedThemeNote() {
  return <Notice>Chủ đề đã kết thúc theo phiên bản cũ; giữ hồ sơ đã duyệt, không cần sửa theo phiên bản mới.</Notice>;
}

/**
 * Danh sách ô đỏ của bản chép: mục bị bỏ (Bỏ tham chiếu) và mục đổi (Đã kiểm tra). Còn mục đỏ thì không gửi duyệt được.
 */
export function VersionFlagsPanel({ flags, doc, editable, onCheck, onDrop }) {
  if (!flags.length) return null;
  const open = unresolvedFlags(flags, doc);
  return (
    <Notice tone={open.length ? 'err' : 'ok'}>
      <div className="stack">
        <strong>
          {open.length
            ? `Còn ${open.length} mục đổi theo kế hoạch năm mới cần sửa (ô đỏ) trước khi gửi duyệt`
            : 'Đã sửa hết các mục đổi theo kế hoạch năm mới'}
        </strong>
        <ul className="stack">
          {flags.map((f) => {
            const done = !open.includes(f);
            return (
              <li key={f.ref} className="row row--between row--wrap gap-2">
                <span className="row gap-2">
                  <StatusBadge tone={done ? 'green' : 'red'} label={done ? 'Đã kiểm tra' : f.label} size="sm" />
                  <span className={done ? 'muted' : 'field__error'}>{f.message}</span>
                </span>
                {editable && !done && (
                  <button
                    type="button"
                    className={`btn btn--sm ${f.type === 'removed' ? 'btn--outline-danger' : ''}`}
                    onClick={() => (f.type === 'removed' ? onDrop(f) : onCheck(f))}
                  >
                    {f.type === 'removed' ? <Trash2 size={16} aria-hidden /> : <Check size={16} aria-hidden />}{' '}
                    {f.type === 'removed' ? 'Bỏ tham chiếu' : 'Đã kiểm tra'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Notice>
  );
}

/** Nhãn đỏ cạnh ô có tham chiếu cần sửa; chữ để không chỉ dựa vào màu. */
export function FlagTag({ flag, doc }) {
  if (!flag || !unresolvedFlags([flag], doc).length) return null;
  return <StatusBadge tone="red" label={flag.type === 'removed' ? 'Bị bỏ ở KH năm mới' : 'Đổi ở KH năm mới'} size="sm" />;
}
