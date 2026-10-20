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
import { IssueLotAllocation } from '@/components/kitchen/IssueLotAllocation';
import { KbCampusFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { canManageStock } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { clickableRowProps } from '@/utils/clickableRow';
import { formatDate, formatDateTime } from '@/utils/format';
import { ISSUE_HISTORY_LABELS, ISSUE_STATUS, isIssuePosted } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const shortOf = (issue) => issue.items.filter((it) => it.shortage > 0);
const lotsText = (it) => it.allocations.map((a) => `${a.lotNo || 'Tồn đầu kỳ'}: ${fmtQty(a.qty)}`).join(' · ');
// Nhập bổ sung đúng lượng thiếu: mở form phiếu nhập điền sẵn các dòng
const restockLink = (issue) =>
  `/kitchen/stock-receipts/new?campusId=${issue.campusId}&items=${shortOf(issue)
    .map((it) => `${it.foodId}:${it.shortage}`)
    .join(',')}`;

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
            <th>Lô xuất</th>
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
              <td>{lotsText(it)}</td>
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
 * Phiếu xuất kho đồ khô (BA): tự tính khi chốt suất cả ngày = suất chốt × định lượng. Thiếu một dòng ⇒ dừng cả phiếu chờ
 * PHT nhập bổ sung; đủ hàng ⇒ bếp chọn lô ⇒ hệ thống ghi xuất một lần. Không duyệt; danh sách bên trái, panel chi tiết bên phải.
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
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Mã phiếu</th>
                <th className="num">Số thực phẩm</th>
                <th className="center">Thiếu tồn</th>
                <th className="center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.today && (
                <tr>
                  <td>{formatDate(data.today.date)}</td>
                  <td className="muted">—</td>
                  <td className="num muted">—</td>
                  <td className="muted">—</td>
                  <td className="center">
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
                    aria-selected={issue.id === openId}
                    {...clickableRowProps(() => setOpenId(issue.id))}
                  >
                    <td>{formatDate(issue.date)}</td>
                    <td className="fw-600 text-primary">{issue.code}</td>
                    <td className="num">{issue.items.length}</td>
                    <td>
                      {short.length ? <span className="chip chip--red">{short.length} thực phẩm</span> : <span className="muted">—</span>}
                    </td>
                    <td className="center">
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
          <p className="page__desc">
            Tính theo suất chốt × định lượng khi chốt suất cả ngày. Thiếu hàng thì dừng cả phiếu; đủ hàng thì bếp chọn lô để ghi xuất.
          </p>
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
              <IssueStatusBadge status={open.status} /> ·{' '}
              {open.issuedAt
                ? `${formatDateTime(open.issuedAt)}${open.postedByName ? ` · ${open.postedByName}` : ''}`
                : 'Chưa ghi xuất kho'}
            </p>
            {open.needChanged && (
              <div className="alert alert--warning">
                <AlertTriangle size={18} />
                <div>Số suất chốt đã thay đổi sau khi ghi xuất. Kho chưa tự điều chỉnh (quy tắc điều chỉnh còn chờ chốt).</div>
              </div>
            )}
            {open.status === ISSUE_STATUS.AWAITING_STOCK && (
              <div className="alert alert--danger">
                <AlertTriangle size={18} />
                <div>
                  Thiếu {shortOf(open).length} thực phẩm nên dừng cả phiếu, chưa xuất dòng nào. Nhập bổ sung xong phiếu tự chuyển sang bước
                  chọn lô.
                  {canManageStock(user) && (
                    <>
                      {' '}
                      <Link to={restockLink(open)}>Nhập kho bổ sung</Link>
                    </>
                  )}
                </div>
              </div>
            )}
            {open.status === ISSUE_STATUS.AWAITING_LOT_ALLOCATION && data.canAllocate ? (
              <IssueLotAllocation issue={open} onPosted={() => reload({ silent: true })} />
            ) : (
              <>
                {open.status === ISSUE_STATUS.AWAITING_LOT_ALLOCATION && (
                  <p className="text-sm muted">Đủ hàng, chờ nhân viên bếp chọn lô để ghi xuất.</p>
                )}
                <div className="table-wrap">
                  <table className="table table--grid table--compact">
                    <thead>
                      <tr>
                        <th>Thực phẩm</th>
                        <th className="num">Cần xuất</th>
                        {isIssuePosted(open.status) ? (
                          <>
                            <th className="num">Đã xuất</th>
                            <th>Lô xuất</th>
                          </>
                        ) : (
                          <>
                            <th className="num">Tồn khả dụng</th>
                            <th className="num">Thiếu</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {open.items.map((it) => (
                        <tr key={it.foodId} className={it.shortage > 0 ? 'kb-row--short' : undefined}>
                          <td>
                            {it.name} <span className="text-xs muted">{it.unit}</span>
                          </td>
                          <td className="num">{fmtQty(it.requiredQty)}</td>
                          {isIssuePosted(open.status) ? (
                            <>
                              <td className="num">{fmtQty(it.issuedQty)}</td>
                              <td className="text-sm">{lotsText(it) || <span className="muted">—</span>}</td>
                            </>
                          ) : (
                            <>
                              <td className="num">{it.availableQty == null ? '—' : fmtQty(it.availableQty)}</td>
                              <td className={`num ${it.shortage > 0 ? 'kb-short' : 'muted'}`}>
                                {it.shortage > 0 ? fmtQty(it.shortage) : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
