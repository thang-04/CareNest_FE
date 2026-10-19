import { forwardRef, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Printer } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useKitchenCampus, useStockIssues } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, PrintHeader, PrintToolbar } from '@/components';
import { Modal } from '@/components/ui/Modal';
import { SidePanel } from '@/components/ui/SidePanel';
import { IssueStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbCampusFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { canManageStock } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime } from '@/utils/format';
import { ISSUE_HISTORY_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const shortOf = (issue) => issue.items.filter((it) => it.shortage > 0);

/** Phiếu xuất kho A4: thực phẩm, cần xuất, đã xuất, thiếu; ký tay. */
const IssuePrint = forwardRef(function IssuePrint({ issue, campusName }, ref) {
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>PHIẾU XUẤT KHO</h1>
        <div>
          {issue.code} · Ngày {formatDate(issue.date)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      <table className="ps-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Thực phẩm</th>
            <th>ĐVT</th>
            <th>Cần xuất</th>
            <th>Đã xuất</th>
            <th>Thiếu</th>
          </tr>
        </thead>
        <tbody>
          {issue.items.map((it, i) => (
            <tr key={it.foodId}>
              <td className="c">{i + 1}</td>
              <td>{it.name}</td>
              <td className="c">{it.unit}</td>
              <td className="c">{fmtQty(it.requiredQty)}</td>
              <td className="c">{fmtQty(it.issuedQty)}</td>
              <td className="c">{it.shortage > 0 ? fmtQty(it.shortage) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="ps-table ps-sign kb-print-sign">
        <tbody>
          <tr>
            {['Người lập', 'Bếp', 'Phó hiệu trưởng'].map((t) => (
              <td key={t}>
                <div className="ps-sign__title">{t}</div>
                <div className="ps-sign__role">(Ký, ghi rõ họ tên)</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
});

/**
 * Phiếu xuất kho đồ khô (khảo sát 18/10/2026, S8): phiếu tự sinh khi chốt suất cả ngày = suất chốt × định lượng, trừ tồn ngay.
 * Không duyệt, không bước bếp xác nhận nhận. Danh sách bên trái, bấm phiếu mở panel chi tiết; chỉ xem và in.
 */
export default function StockIssuePage() {
  const { user } = useAuth();
  const md = useMasterData();
  const { campusId, setCampusId, canPick } = useKitchenCampus(md.campuses[0]?.id);
  const { data, loading, error, reload } = useStockIssues(campusId);
  const [openId, setOpenId] = useState(null);
  const [printing, setPrinting] = useState(false);
  const sheetRef = useRef(null);
  const campus = md.campusById(campusId);
  const open = data?.issues.find((i) => i.id === openId) || null;

  let body;
  if (md.error && !campusId) body = <ErrorState error={md.error} onRetry={md.reload} />;
  else if (!campusId || (!data && !error) || (loading && !data)) body = <LoadingState />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!data.issues.length && !data.today)
    body = (
      <section className="card">
        <EmptyState icon={ClipboardList} title="Chưa có phiếu xuất kho" description="Phiếu xuất kho tự sinh khi chốt suất cả ngày." />
      </section>
    );
  else
    body = (
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Mã phiếu</th>
                <th className="right">Số thực phẩm</th>
                <th>Thiếu tồn</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.today && (
                <tr>
                  <td>{formatDate(data.today.date)}</td>
                  <td className="muted">—</td>
                  <td className="right muted">—</td>
                  <td className="muted">—</td>
                  <td>
                    <IssueStatusBadge status={data.today.state} />
                  </td>
                </tr>
              )}
              {data.issues.map((issue) => {
                const short = shortOf(issue);
                return (
                  <tr
                    key={issue.id}
                    className={`row-click ${issue.id === openId ? 'row--selected' : ''}`}
                    tabIndex={0}
                    aria-selected={issue.id === openId}
                    onClick={() => setOpenId(issue.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenId(issue.id))}
                  >
                    <td>{formatDate(issue.date)}</td>
                    <td className="fw-600 text-primary">{issue.code}</td>
                    <td className="right">{issue.items.length}</td>
                    <td>
                      {short.length ? <span className="chip chip--red">{short.length} thực phẩm</span> : <span className="muted">—</span>}
                    </td>
                    <td>
                      <IssueStatusBadge status={issue.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockIssues)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Phiếu xuất kho</h1>
          <p className="page__desc">Đồ khô xuất tự động khi chốt suất cả ngày, theo suất chốt × định lượng. Không cần duyệt.</p>
        </div>
      </div>
      <div className="kb-toolbar kb-toolbar--center">
        <KbCampusFilter campusId={campusId} onChange={(id) => (setCampusId(id), setOpenId(null))} canPick={canPick} />
        <span className="text-sm muted">30 ngày gần nhất</span>
      </div>
      {body}

      <SidePanel
        open={!!open}
        title={open ? `${open.code} · ${formatDate(open.date)}` : ''}
        onClose={() => setOpenId(null)}
        footer={
          open && (
            <button type="button" className="btn" onClick={() => setPrinting(true)}>
              <Printer size={16} /> In phiếu
            </button>
          )
        }
      >
        {open && (
          <div className="kb-stack">
            <p className="text-sm muted">
              <IssueStatusBadge status={open.status} /> · {open.issuedAt ? formatDateTime(open.issuedAt) : 'Chưa ghi nhận xuất kho'}
            </p>
            {shortOf(open).length > 0 && (
              <div className="alert alert--danger">
                <AlertTriangle size={18} />
                <div>
                  Tồn không đủ cho {shortOf(open).length} thực phẩm, đã xuất phần còn trong kho.
                  {canManageStock(user) && (
                    <>
                      {' '}
                      <Link to="/kitchen/stock-receipts/new">Nhập kho bổ sung</Link>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Thực phẩm</th>
                    <th className="right">Cần xuất</th>
                    <th className="right">Đã xuất</th>
                    <th className="right">Thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {open.items.map((it) => (
                    <tr key={it.foodId} className={it.shortage > 0 ? 'kb-row--short' : undefined}>
                      <td>
                        {it.name} <span className="text-xs muted">{it.unit}</span>
                      </td>
                      <td className="right">{fmtQty(it.requiredQty)}</td>
                      <td className="right">{fmtQty(it.issuedQty)}</td>
                      <td className={`right ${it.shortage > 0 ? 'kb-short' : 'muted'}`}>{it.shortage > 0 ? fmtQty(it.shortage) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {open.history.length > 0 && (
              <div>
                <div className="subsection-title">Nhật ký phiếu</div>
                <ul className="history-list">
                  {[...open.history].reverse().map((h, i) => (
                    <li key={`${h.action}-${i}`}>
                      <div className="history-list__dot" />
                      <div>
                        <div>
                          <b>{ISSUE_HISTORY_LABELS[h.action] || h.action}</b> ·{' '}
                          {h.userId ? md.userById(h.userId)?.fullName || '' : 'Hệ thống'}
                        </div>
                        <div className="muted text-xs">{formatDateTime(h.at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </SidePanel>

      {open && (
        <Modal
          open={printing}
          onClose={() => setPrinting(false)}
          size="xl"
          className="kb-print-modal"
          title="Phiếu xuất kho"
          footer={<PrintToolbar sheetRef={sheetRef} fileBase={`Phieu_xuat_kho_${open.date}`} printLabel="In phiếu" />}
        >
          <div className="print-preview__paper">
            <IssuePrint ref={sheetRef} issue={open} campusName={campus?.shortName || campus?.name} />
          </div>
        </Modal>
      )}
    </div>
  );
}
