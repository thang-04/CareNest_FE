import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Send,
  CheckCheck,
  Search,
  RotateCcw,
  CheckCircle2,
  Info,
  Lock,
  UserRound,
  ListChecks,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { ConditionSelect, ConditionBadge, AssetThumb } from '@/components/asset/AssetVisuals';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { useInspection } from '@/hooks/inventory-inspection/useInspections';
import {
  saveInspectionSheet,
  submitInspectionSheet,
  approveInspectionSheet,
  requestInspectionRecount,
} from '@/services/inventory-inspection/inspectionService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { SheetStatusBadge, ProgressBar } from '@/components/inventory-inspection/InspectionBadges';
import { SHEET_STATUS } from '@/models/inventory-inspection/inspectionConstants';
import { sheetSummary, isItemCounted } from '@/models/inventory-inspection/InspectionRound';
import { validateSheet, hasErrors } from '@/utils/inventory-inspection/inspectionValidation';
import { canCountSheet, canReviewSheet, isMySheet, isVicePrincipal } from '@/utils/inventory-inspection/inspectionPermissions';
import { inspectionCrumbs } from '@/utils/inventory-inspection/breadcrumbs';
import { formatDate, formatDateTime, normalizeText } from '@/utils/format';
import { locationLabel } from '@/models/Location';
import { ROLE_LABELS } from '@/models/User';
import '@/styles/modules/inventory-inspection.css';

const FILTERS = [
  { key: 'ALL', label: 'Tất cả', match: () => true },
  { key: 'TODO', label: 'Chưa kiểm', match: (i) => !isItemCounted(i) },
  { key: 'VARIANCE', label: 'Lệch sổ sách', match: (i) => isItemCounted(i) && Number(i.actualQuantity) !== i.bookQuantity },
  { key: 'DAMAGED', label: 'Hư hỏng', match: (i) => ['NEED_REPAIR', 'BROKEN'].includes(i.actualCondition) },
  { key: 'FLAGGED', label: 'Cần kiểm lại', match: (i) => i.flagged },
];

const Diff = ({ item }) => {
  if (!isItemCounted(item)) return <span className="muted">—</span>;
  const d = Number(item.actualQuantity) - item.bookQuantity;
  if (d === 0) return <span className="text-success">0</span>;
  return <span className={`kk-diff ${d < 0 ? 'kk-diff--minus' : 'kk-diff--plus'}`}>{d > 0 ? `+${d}` : d}</span>;
};

function SheetHeader({ round, sheet, md }) {
  const inspector = md.userById(sheet.inspectorUserId);
  return (
    <div className="card card--soft-header mt-16">
      <div className="card__header">
        <div className="card__title">
          <ListChecks size={20} /> Thông tin phiếu kiểm kê
        </div>
      </div>
      <div className="card__body info-columns">
        <dl className="info-list">
          <dt>Mã phiếu:</dt>
          <dd className="fw-600">{sheet.code}</dd>
          <dt>Đợt kiểm kê:</dt>
          <dd>
            {round.code} – {round.name}
          </dd>
          <dt>Lớp/phòng:</dt>
          <dd className="fw-600">{locationLabel(md.locationById(sheet.locationId))}</dd>
        </dl>
        <dl className="info-list">
          <dt>Người kiểm kê:</dt>
          <dd>
            {inspector?.fullName} ({ROLE_LABELS[inspector?.role]})
          </dd>
          <dt>Thời gian:</dt>
          <dd>
            {formatDate(round.startDate)} – {formatDate(round.deadline)}
          </dd>
          <dt>Người lập:</dt>
          <dd>{md.userById(round.createdBy)?.fullName}</dd>
        </dl>
        <dl className="info-list">
          <dt>Yêu cầu:</dt>
          <dd>{round.note || '—'}</dd>
          {sheet.submittedAt && (
            <>
              <dt>Nộp lúc:</dt>
              <dd>
                {formatDateTime(sheet.submittedAt)}
                {sheet.submitCount > 1 ? ` (lần ${sheet.submitCount})` : ''}
              </dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}

function SummaryStats({ items }) {
  const s = sheetSummary({ items });
  return (
    <div className="kk-stats mt-16">
      <div className="kk-stat">
        <div className="kk-stat__value">{s.total}</div>
        <div className="kk-stat__label">Tài sản cần kiểm</div>
      </div>
      <div className={`kk-stat ${s.counted === s.total ? 'kk-stat--ok' : ''}`}>
        <div className="kk-stat__value">
          {s.counted}/{s.total}
        </div>
        <div className="kk-stat__label">Đã kiểm</div>
      </div>
      <div className={`kk-stat ${s.variance ? 'kk-stat--warn' : ''}`}>
        <div className="kk-stat__value">{s.variance}</div>
        <div className="kk-stat__label">Lệch sổ sách</div>
      </div>
      <div className={`kk-stat ${s.damaged ? 'kk-stat--danger' : ''}`}>
        <div className="kk-stat__value">{s.damaged}</div>
        <div className="kk-stat__label">Hư hỏng / cần sửa</div>
      </div>
    </div>
  );
}

/* ================= Inspector: counting ================= */
function CountView({ round, sheet, md, reload }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState(() => sheet.items.map((i) => ({ ...i })));
  const [errors, setErrors] = useState({});
  const [filter, setFilter] = useState(sheet.status === SHEET_STATUS.RECOUNT_REQUESTED ? 'FLAGGED' : 'ALL');
  const [keyword, setKeyword] = useState('');
  const [signature, setSignature] = useState(null);
  const [sigError, setSigError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const onSignature = useCallback(({ url }) => {
    setSignature(url);
    setSigError('');
  }, []);

  const update = (assetId, patch) => {
    setItems((list) => list.map((i) => (i.assetId === assetId ? { ...i, ...patch } : i)));
    setErrors((e) => ({ ...e, [assetId]: undefined }));
    setDirty(true);
  };

  // Quick fill: everything not yet counted matches the book.
  const fillMatching = () => {
    setItems((list) =>
      list.map((i) =>
        isItemCounted(i) ? i : { ...i, actualQuantity: i.bookQuantity, actualCondition: i.actualCondition || i.bookCondition },
      ),
    );
    setDirty(true);
    toast.info('Đã điền “khớp sổ sách” cho các tài sản chưa kiểm. Hãy sửa lại những tài sản lệch hoặc hư hỏng.');
  };

  const recount = sheet.recountRequests[sheet.recountRequests.length - 1];
  const summary = sheetSummary({ items });
  const current = FILTERS.find((f) => f.key === filter);
  const visible = items.filter(
    (i) => current.match(i) && (!keyword || normalizeText(`${i.assetCode} ${i.assetName}`).includes(normalizeText(keyword))),
  );

  const save = async () => {
    setSaving(true);
    try {
      await saveInspectionSheet(round.id, sheet.id, items, user);
      setDirty(false);
      toast.success('Đã lưu tạm phiếu kiểm kê');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const askSubmit = () => {
    const e = validateSheet(items);
    setErrors(e);
    if (!signature) setSigError('Vui lòng chọn chữ ký');
    if (hasErrors(e)) {
      setFilter('ALL');
      toast.error(`Còn ${Object.keys(e).length} tài sản chưa đủ thông tin. Kiểm tra các dòng báo đỏ.`);
      return;
    }
    if (!signature) return;
    setConfirmOpen(true);
  };

  const submit = async () => {
    try {
      await submitInspectionSheet(round.id, sheet.id, { items, signatureUrl: signature }, user);
      toast.success('Đã nộp phiếu kiểm kê cho Phó hiệu trưởng', 'Nộp phiếu thành công');
      setConfirmOpen(false);
      setDirty(false);
      reload();
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err.message, 'Không nộp được phiếu');
    }
  };

  return (
    <>
      {recount ? (
        <div className="alert alert--danger mt-16">
          <RotateCcw size={18} />
          <div>
            <b>Phó hiệu trưởng yêu cầu kiểm lại</b> ({formatDateTime(recount.requestedAt)}): “{recount.reason}”.
            {recount.itemIds.length > 0 && <div>Các tài sản cần kiểm lại được đánh dấu đỏ ở cột đầu (lọc “Cần kiểm lại”).</div>}
          </div>
        </div>
      ) : (
        <div className="alert alert--info mt-16">
          <Info size={18} />
          <div>
            Đếm thực tế từng tài sản và chọn tình trạng. <b>Lệch sổ sách</b> phải ghi chú; <b>Cần sửa chữa</b> phải mô tả; <b>Hỏng</b> phải
            mô tả và có ít nhất 1 ảnh. Có thể bấm “Lưu tạm” và quay lại sau.
          </div>
        </div>
      )}

      <SheetHeader round={round} sheet={sheet} md={md} />
      <SummaryStats items={items} />

      <div className="card mt-16">
        <div className="card__body">
          <div className="kk-toolbar">
            <div className="kk-filters">
              {FILTERS.filter((f) => f.key !== 'FLAGGED' || items.some((i) => i.flagged)).map((f) => (
                <button key={f.key} className={`kk-filter ${filter === f.key ? 'kk-filter--active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label} ({items.filter(f.match).length})
                </button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label className="search-box" style={{ minWidth: 220 }}>
                <Search size={16} className="muted" />
                <input placeholder="Tìm tài sản..." value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Tìm tài sản" />
              </label>
              <button
                className="btn btn--outline-primary"
                onClick={fillMatching}
                disabled={summary.counted === summary.total}
                title="Điền số thực tế = sổ sách cho các dòng chưa kiểm"
              >
                <CheckCheck size={16} /> Khớp sổ sách
              </button>
            </div>
          </div>
          <ProgressBar
            value={summary.counted}
            total={summary.total}
            tone={summary.counted === summary.total ? 'green' : 'primary'}
            label={`Đã kiểm ${summary.counted}/${summary.total}`}
          />

          <div className="table-wrap mt-12">
            <table className="table">
              <thead>
                <tr>
                  <th className="center">STT</th>
                  <th>Tài sản</th>
                  <th className="center">ĐVT</th>
                  <th className="center">SL sổ sách</th>
                  <th className="center">SL thực tế</th>
                  <th className="center">Chênh lệch</th>
                  <th style={{ width: 160 }}>Tình trạng</th>
                  <th style={{ minWidth: 200 }}>Ghi chú</th>
                  <th className="center">Ảnh</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={9}>
                      <EmptyState title="Không có tài sản phù hợp bộ lọc" />
                    </td>
                  </tr>
                ) : (
                  visible.map((i) => {
                    const idx = items.indexOf(i);
                    const err = errors[i.assetId];
                    const counted = isItemCounted(i);
                    const variance = counted && Number(i.actualQuantity) !== i.bookQuantity;
                    const damaged = ['NEED_REPAIR', 'BROKEN'].includes(i.actualCondition);
                    const q = i.actualQuantity === null || i.actualQuantity === '' ? '' : i.actualQuantity;
                    return (
                      <tr
                        key={i.assetId}
                        className={`${damaged ? 'kk-row--damaged' : variance ? 'kk-row--variance' : ''} ${i.flagged ? 'kk-row--flagged' : ''}`}
                      >
                        <td className="center">{idx + 1}</td>
                        <td>
                          <div className="row" style={{ gap: 10 }}>
                            <AssetThumb asset={i} size="sm" />
                            <div>
                              <div className="fw-600">{i.assetName}</div>
                              <div className="muted text-xs">{i.assetCode}</div>
                            </div>
                          </div>
                          {err && <div className="kk-row-error">{err}</div>}
                        </td>
                        <td className="center">{i.unit}</td>
                        <td className="center fw-600">{i.bookQuantity}</td>
                        <td className="center">
                          <span className={`kk-qty ${err && !counted ? 'kk-qty--error' : ''}`}>
                            <button
                              type="button"
                              onClick={() => update(i.assetId, { actualQuantity: Math.max(0, (Number(q) || 0) - 1) })}
                              aria-label="Giảm"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={q}
                              placeholder="?"
                              onChange={(e) => update(i.assetId, { actualQuantity: e.target.value === '' ? '' : Number(e.target.value) })}
                              aria-label={`Số lượng thực tế ${i.assetName}`}
                            />
                            <button
                              type="button"
                              onClick={() => update(i.assetId, { actualQuantity: (q === '' ? i.bookQuantity - 1 : Number(q)) + 1 })}
                              aria-label="Tăng"
                            >
                              +
                            </button>
                          </span>
                        </td>
                        <td className="center">
                          <Diff item={i} />
                        </td>
                        <td>
                          <ConditionSelect value={i.actualCondition} onChange={(v) => update(i.assetId, { actualCondition: v })} />
                        </td>
                        <td>
                          <input
                            className={`input ${err && /ghi chú|mô tả/.test(err) ? 'input--error' : ''}`}
                            value={i.note}
                            placeholder={variance || damaged ? 'Bắt buộc ghi chú...' : 'Ghi chú...'}
                            onChange={(e) => update(i.assetId, { note: e.target.value })}
                            aria-label={`Ghi chú ${i.assetName}`}
                          />
                        </td>
                        <td className="center">
                          <ImageUploader images={i.images} onChange={(imgs) => update(i.assetId, { images: imgs })} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="split-2 mt-16">
        <div className="card card--soft-header">
          <div className="card__header">
            <div className="card__title">
              <UserRound size={20} /> Chữ ký người kiểm kê
            </div>
          </div>
          <div className="card__body">
            <SignaturePicker variant="compact" value={signature} onChange={onSignature} error={sigError} />
          </div>
        </div>
        <div className="card card--soft-header">
          <div className="card__header">
            <div className="card__title">
              <Info size={20} /> Trước khi nộp
            </div>
          </div>
          <div className="card__body stack text-sm" style={{ gap: 8 }}>
            <div>
              {summary.counted === summary.total ? (
                <span className="text-success row" style={{ gap: 4 }}>
                  <CheckCircle2 size={16} aria-hidden="true" /> Đã kiểm đủ {summary.total} tài sản
                </span>
              ) : (
                <span className="text-danger">Còn {summary.total - summary.counted} tài sản chưa kiểm</span>
              )}
            </div>
            <div>{summary.variance ? `${summary.variance} tài sản lệch sổ sách (cần ghi chú)` : 'Không có tài sản lệch sổ sách'}</div>
            <div>{summary.damaged ? `${summary.damaged} tài sản hư hỏng / cần sửa (cần mô tả, ảnh)` : 'Không có tài sản hư hỏng'}</div>
            {sheet.savedAt && <div className="muted">Lưu tạm lần cuối: {formatDateTime(sheet.savedAt)}</div>}
          </div>
        </div>
      </div>

      <div className="page-actions">
        <button className="btn btn--lg" onClick={() => navigate('/facility/inspections')}>
          <ArrowLeft size={17} /> Quay lại
        </button>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn--lg" onClick={save} disabled={saving || !dirty}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu tạm
          </button>
          <button className="btn btn--lg btn--primary" onClick={askSubmit}>
            <Send size={16} /> Ký và nộp phiếu
          </button>
        </div>
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title="Nộp phiếu kiểm kê?"
        message={`Bạn xác nhận đã kiểm đếm thực tế ${summary.total} tài sản tại ${locationLabel(md.locationById(sheet.locationId))}: ${summary.variance} tài sản lệch sổ sách, ${summary.damaged} tài sản hư hỏng/cần sửa. Sau khi nộp không sửa được, trừ khi PHT yêu cầu kiểm lại.`}
        confirmLabel="Ký và nộp phiếu"
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      >
        {signature && (
          <div className="sig-box mt-12">
            <img src={signature} alt="Chữ ký sẽ dùng" />
          </div>
        )}
      </ConfirmationModal>
    </>
  );
}

/* ================= VP review / read-only ================= */
function ReviewView({ round, sheet, md, reload }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [recountOpen, setRecountOpen] = useState(false);
  const [recountReason, setRecountReason] = useState('');
  const [recountItems, setRecountItems] = useState([]);
  const [recountError, setRecountError] = useState('');
  const [busy, setBusy] = useState(false);
  const reviewable = canReviewSheet(round, sheet, user);
  const current = FILTERS.find((f) => f.key === filter);
  const items = sheet.items.filter(current.match);
  const inspector = md.userById(sheet.inspectorUserId);
  const problemIds = sheet.items
    .filter((i) => Number(i.actualQuantity) !== i.bookQuantity || ['NEED_REPAIR', 'BROKEN'].includes(i.actualCondition))
    .map((i) => i.assetId);

  const openRecount = () => {
    setRecountItems(problemIds);
    setRecountReason('');
    setRecountError('');
    setRecountOpen(true);
  };

  const doApprove = async () => {
    try {
      await approveInspectionSheet(round.id, sheet.id, approveNote, user);
      toast.success(`Đã duyệt phiếu ${sheet.code}`);
      setApproveOpen(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doRecount = async () => {
    if (!recountReason.trim()) {
      setRecountError('Vui lòng nhập lý do kiểm lại');
      return;
    }
    setBusy(true);
    try {
      await requestInspectionRecount(round.id, sheet.id, { reason: recountReason, itemIds: recountItems }, user);
      toast.success('Đã gửi yêu cầu kiểm lại cho người kiểm kê', 'Yêu cầu kiểm lại');
      setRecountOpen(false);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const statusText = {
    ASSIGNED: `${inspector?.fullName} chưa bắt đầu kiểm kê.`,
    IN_PROGRESS: `${inspector?.fullName} đang kiểm kê (đã lưu tạm${sheet.savedAt ? ` lúc ${formatDateTime(sheet.savedAt)}` : ''}).`,
    SUBMITTED: `Đã nộp lúc ${formatDateTime(sheet.submittedAt)}, đang chờ Phó hiệu trưởng duyệt.`,
    RECOUNT_REQUESTED: 'Đã yêu cầu kiểm lại, chờ người kiểm kê nộp lại.',
    APPROVED: `Đã duyệt lúc ${formatDateTime(sheet.approvedAt)}.`,
    CANCELLED: 'Phiếu đã hủy.',
  }[sheet.status];

  return (
    <>
      {reviewable ? (
        <div className="alert alert--purple mt-16">
          <ListChecks size={18} />
          <div>
            Kiểm tra kết quả: dòng <b>vàng</b> là lệch sổ sách, dòng <b>đỏ</b> là hư hỏng. Số liệu đúng thì <b>Duyệt phiếu</b>; nghi ngờ thì{' '}
            <b>Yêu cầu kiểm lại</b> (chọn tài sản cần đếm lại).
          </div>
        </div>
      ) : (
        statusText && (
          <div className="alert alert--info mt-16">
            <Info size={18} />
            <div>{statusText}</div>
          </div>
        )
      )}

      <SheetHeader round={round} sheet={sheet} md={md} />
      <SummaryStats items={sheet.items} />

      {sheet.recountRequests.length > 0 && (
        <div className="card mt-16">
          <div className="card__body">
            <div className="subsection-title">Lịch sử yêu cầu kiểm lại</div>
            {sheet.recountRequests.map((r, k) => (
              <div key={k} className="text-2 text-sm">
                • {formatDateTime(r.requestedAt)}: “{r.reason}” ({r.itemIds.length} tài sản)
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mt-16">
        <div className="card__body">
          <div className="kk-toolbar">
            <div className="kk-filters">
              {FILTERS.filter((f) => f.key !== 'TODO' && (f.key !== 'FLAGGED' || sheet.items.some((i) => i.flagged))).map((f) => (
                <button key={f.key} className={`kk-filter ${filter === f.key ? 'kk-filter--active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label} ({sheet.items.filter(f.match).length})
                </button>
              ))}
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="center">STT</th>
                  <th>Tài sản</th>
                  <th className="center">ĐVT</th>
                  <th className="center">SL sổ sách</th>
                  <th className="center">SL thực tế</th>
                  <th className="center">Chênh lệch</th>
                  <th className="center">TT sổ sách</th>
                  <th className="center">TT thực tế</th>
                  <th>Ghi chú</th>
                  <th className="center">Ảnh</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState title="Không có tài sản phù hợp" />
                    </td>
                  </tr>
                ) : (
                  items.map((i) => {
                    const counted = isItemCounted(i);
                    const variance = counted && i.actualQuantity !== i.bookQuantity;
                    const damaged = ['NEED_REPAIR', 'BROKEN'].includes(i.actualCondition);
                    return (
                      <tr
                        key={i.assetId}
                        className={`${damaged ? 'kk-row--damaged' : variance ? 'kk-row--variance' : ''} ${i.flagged ? 'kk-row--flagged' : ''}`}
                      >
                        <td className="center">{sheet.items.indexOf(i) + 1}</td>
                        <td>
                          <div className="fw-600">{i.assetName}</div>
                          <div className="muted text-xs">{i.assetCode}</div>
                        </td>
                        <td className="center">{i.unit}</td>
                        <td className="center">{i.bookQuantity}</td>
                        <td className="center fw-600">{counted ? i.actualQuantity : '—'}</td>
                        <td className="center">
                          <Diff item={i} />
                        </td>
                        <td className="center">
                          <ConditionBadge value={i.bookCondition} />
                        </td>
                        <td className="center">{i.actualCondition ? <ConditionBadge value={i.actualCondition} /> : '—'}</td>
                        <td className="text-2">{i.note || '—'}</td>
                        <td className="center">
                          <ImageUploader images={i.images} disabled />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card card--soft-header mt-16">
        <div className="card__header">
          <div className="card__title">
            <UserRound size={20} /> Chữ ký người kiểm kê
          </div>
        </div>
        <div className="card__body">
          {sheet.inspectorSignature ? (
            <div className="sig-box" style={{ maxWidth: 320 }}>
              <img src={sheet.inspectorSignature.signatureUrl} alt="Chữ ký người kiểm kê" />
              <div className="fw-600">{sheet.inspectorSignature.signedByName}</div>
              <div className="text-success text-xs">
                <CheckCircle2 size={13} /> Đã ký {formatDateTime(sheet.inspectorSignature.signedAt)}
              </div>
            </div>
          ) : (
            <div className="muted">Chưa ký</div>
          )}
          {sheet.approvedAt && (
            <div className="text-success mt-8">
              PHT {md.userById(sheet.approvedBy)?.fullName} đã duyệt lúc {formatDateTime(sheet.approvedAt)}
              {sheet.reviewNote ? ` – “${sheet.reviewNote}”` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="page-actions">
        <button
          className="btn btn--lg"
          onClick={() => navigate(isVicePrincipal(user) ? `/facility/inspections/${round.id}` : '/facility/inspections')}
        >
          <ArrowLeft size={17} /> Quay lại
        </button>
        {reviewable && (
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn--lg btn--warning" onClick={openRecount}>
              <RotateCcw size={16} /> Yêu cầu kiểm lại
            </button>
            <button className="btn btn--lg btn--primary" onClick={() => setApproveOpen(true)}>
              <CheckCircle2 size={16} /> Duyệt phiếu
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={approveOpen}
        title={`Duyệt phiếu ${sheet.code}?`}
        message="Bạn xác nhận kết quả kiểm kê của lớp/phòng này là chính xác."
        confirmLabel="Duyệt phiếu"
        onConfirm={doApprove}
        onClose={() => setApproveOpen(false)}
      >
        <textarea
          className="textarea mt-12"
          rows={2}
          placeholder="Ghi chú khi duyệt (không bắt buộc)"
          value={approveNote}
          onChange={(e) => setApproveNote(e.target.value)}
          aria-label="Ghi chú duyệt"
        />
      </ConfirmationModal>

      <Modal
        open={recountOpen}
        size="lg"
        title={`Yêu cầu kiểm lại ${sheet.code}`}
        onClose={busy ? undefined : () => setRecountOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setRecountOpen(false)} disabled={busy}>
              Quay lại
            </button>
            <button className="btn btn--warning" onClick={doRecount} disabled={busy}>
              {busy ? <Spinner small /> : <RotateCcw size={16} />} Gửi yêu cầu kiểm lại
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field__label" htmlFor="recount-reason">
            Lý do kiểm lại<span className="req">*</span>
          </label>
          <textarea
            id="recount-reason"
            className={`textarea ${recountError ? 'textarea--error' : ''}`}
            rows={3}
            value={recountReason}
            onChange={(e) => {
              setRecountReason(e.target.value);
              setRecountError('');
            }}
            placeholder="Ví dụ: Máy in ghi 1 nhưng sổ ghi 2, đề nghị kiểm tra lại cả phòng y tế."
          />
          {recountError && <span className="field__error">{recountError}</span>}
        </div>
        <div className="subsection-title mt-16">Tài sản cần đếm lại</div>
        <div className="stack" style={{ gap: 6, maxHeight: 260, overflowY: 'auto' }}>
          {sheet.items.map((i) => (
            <label key={i.assetId} className="checkbox">
              <input
                type="checkbox"
                checked={recountItems.includes(i.assetId)}
                onChange={(e) => setRecountItems((list) => (e.target.checked ? [...list, i.assetId] : list.filter((x) => x !== i.assetId)))}
              />
              {i.assetName} – sổ sách {i.bookQuantity}, thực tế {i.actualQuantity ?? '—'}
              {problemIds.includes(i.assetId) && <span className="chip chip--orange text-2xs">Có chênh lệch</span>}
            </label>
          ))}
        </div>
      </Modal>
    </>
  );
}

/** /facility/inspections/:id/sheets/:sheetId – counting for the inspector, review for the VP. */
export default function InspectionSheetPage() {
  const { id, sheetId } = useParams();
  const { user } = useAuth();
  const md = useMasterData();
  const { round, loading, error, reload } = useInspection(id, { live: false });
  const sheet = useMemo(() => round?.sheets.find((s) => s.id === sheetId), [round, sheetId]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sheetId]);

  if (loading || md.loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (error || md.error)
    return (
      <div className="page">
        <ErrorState error={error || md.error} onRetry={reload} />
      </div>
    );
  if (!sheet || !(isVicePrincipal(user) || isMySheet(sheet, user))) {
    return (
      <div className="page">
        <div className="card mt-24">
          <EmptyState
            icon={Lock}
            title="Bạn không có quyền xem phiếu kiểm kê này"
            action={
              <Link className="btn" to="/facility/inspections">
                Về danh sách
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const counting = canCountSheet(round, sheet, user);
  return (
    <div className="page">
      <Breadcrumb items={inspectionCrumbs(`Phiếu ${sheet.code}`)} />
      <h1 className="page__title" style={{ marginBottom: 8 }}>
        Phiếu kiểm kê {sheet.code} – {locationLabel(md.locationById(sheet.locationId))}
      </h1>
      <SheetStatusBadge status={sheet.status} size="lg" />
      {counting ? (
        <CountView
          key={`${sheet.id}-${sheet.status}-${sheet.submitCount}`}
          round={round}
          sheet={sheet}
          md={md}
          reload={() => reload({ silent: true })}
        />
      ) : (
        <ReviewView key={`${sheet.id}-${sheet.status}`} round={round} sheet={sheet} md={md} reload={() => reload({ silent: true })} />
      )}
    </div>
  );
}
