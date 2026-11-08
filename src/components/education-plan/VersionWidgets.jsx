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

export function VersionBadge({ plan }) {
  return <span className="text-xs text-primary">Phiên bản {versionOf(plan)}</span>;
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
        code: `MT${g.change === CHANGE.REMOVED ? g.fromGoalNo : g.goalNo}`,
        text:
          g.change === CHANGE.REMOVED
            ? g.fromText
            : `${g.text}${g.change === CHANGE.CHANGED && !g.fields.includes('text') ? ' (nội dung giáo dục)' : ''}`,
      })),
    ...(changes?.themes || [])
      .filter((t) => t.change !== CHANGE.UNCHANGED)
      .map((t) => ({ key: `t${t.lineageId}`, change: t.change, code: 'Chủ đề', text: t.name || t.fromName })),
  ];
  return (
    <Card title="Phiên bản" className="mt-16">
      <div className="stack">
        {chain.length > 1 && (
          // Chia cột cho thẳng hàng giữa các phiên bản (Tiền 03/11)
          <div className="table-wrap">
            <table className="table ga-plan-table ga-version-table">
              <colgroup>
                <col className="ga-version-table__version" />
                <col className="ga-version-table__status" />
                <col className="ga-version-table__date" />
                <col />
                <col className="ga-version-table__issued" />
              </colgroup>
              <thead>
                <tr>
                  <th>Phiên bản</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Người tạo</th>
                  <th>Ngày ban hành</th>
                </tr>
              </thead>
              <tbody>
                {chain.map((v) => (
                  <tr key={v.id}>
                    <td>
                      {v.id === plan.id ? (
                        <VersionBadge plan={v} />
                      ) : (
                        <Link to={`/education/goals/${v.id}`}>
                          <VersionBadge plan={v} />
                        </Link>
                      )}
                    </td>
                    <td>
                      <YearPlanStatusBadge
                        doc={goals.find((goal) => String(goal.id) === String(v.id)) || v}
                        status={
                          v.status === 'APPROVED' && !(v.current ?? currentPlanOf(goals, v.ageGroupId, v.schoolYear)?.id === v.id)
                            ? 'REPLACED'
                            : v.status
                        }
                      />
                    </td>
                    <td>{fmtDate(v.createdAt)}</td>
                    <td className="ga-version-table__text" title={v.createdBy || undefined}>
                      {v.createdBy || '—'}
                    </td>
                    <td>{v.issued?.at ? fmtDate(v.issued.at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <div className="table-wrap">
                <table className="table ga-plan-table ga-change-table">
                  <colgroup>
                    <col className="ga-change-table__kind" />
                    <col className="ga-change-table__code" />
                    <col />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="center">Thay đổi</th>
                      <th>Mã</th>
                      <th>Nội dung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changed.map((c) => (
                      <tr key={c.key}>
                        <td className="center">
                          <StatusBadge tone={CHANGE_TONE[c.change]} label={CHANGE_LABEL[c.change]} size="sm" />
                        </td>
                        <td className="nowrap">{c.code}</td>
                        <td>{c.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
