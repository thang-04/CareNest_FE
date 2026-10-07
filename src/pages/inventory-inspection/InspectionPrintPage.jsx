import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useMasterData } from '@/hooks/useMasterData';
import { useInspection } from '@/hooks/inventory-inspection/useInspections';
import { PrintHeader } from '@/components/print/PrintHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { downloadCsv } from '@/utils/exportCsv';
import { ASSET_CONDITION_LABELS } from '@/models/Asset';
import { locationLabel } from '@/models/Location';
import { ROLE_LABELS } from '@/models/User';
import { ROUND_STATUS, ROUND_STATUS_LABELS, ROUND_TYPE_LABELS, SHEET_STATUS } from '@/models/inventory-inspection/inspectionConstants';
import { sheetSummary } from '@/models/inventory-inspection/InspectionRound';
import { inspectionCrumbs } from '@/utils/inventory-inspection/breadcrumbs';
import { describeScope } from '@/utils/inventory-inspection/inspectionScope';
import { formatDate, formatDateTime } from '@/utils/format';

const STAMP_TONE = { DRAFT: 'gray', IN_PROGRESS: 'orange', PENDING_APPROVAL: 'purple', COMPLETED: 'green', CANCELLED: 'gray' };

/** Biên bản kiểm kê tài sản (A4) – same header style as the transfer form. */
export default function InspectionPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const md = useMasterData();
  const { round: r, loading, error, reload } = useInspection(id);
  const sheetRef = useRef(null);

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

  const sheets = r.sheets.filter((s) => s.status !== SHEET_STATUS.CANCELLED);
  const variance = sheets.flatMap((s) =>
    s.items
      .filter(
        (i) =>
          i.actualQuantity != null &&
          (i.actualQuantity !== i.bookQuantity ||
            i.actualCondition !== i.bookCondition ||
            ['NEED_REPAIR', 'BROKEN'].includes(i.actualCondition)),
      )
      .map((i) => ({ ...i, locationId: s.locationId })),
  );
  const creator = r.signatures.find((s) => s.type === 'CREATOR');
  const approver = r.signatures.find((s) => s.type === 'APPROVER');
  const fileBase = `Bien_ban_kiem_ke_${r.code}`;

  const onCsv = () => {
    const rows = [
      ['BIÊN BẢN KIỂM KÊ TÀI SẢN', r.code, r.name],
      ['Trạng thái', ROUND_STATUS_LABELS[r.status]],
      ['Thời gian', `${formatDate(r.startDate)} - ${formatDate(r.deadline)}`],
      [],
      [
        'Mã phiếu',
        'Lớp/phòng',
        'Người kiểm kê',
        'Mã tài sản',
        'Tên tài sản',
        'ĐVT',
        'SL sổ sách',
        'SL thực tế',
        'Chênh lệch',
        'Tình trạng',
        'Ghi chú',
      ],
      ...sheets.flatMap((s) =>
        s.items.map((i) => [
          s.code,
          locationLabel(md.locationById(s.locationId)),
          md.userById(s.inspectorUserId)?.fullName,
          i.assetCode,
          i.assetName,
          i.unit,
          i.bookQuantity,
          i.actualQuantity ?? '',
          i.actualQuantity != null ? i.actualQuantity - i.bookQuantity : '',
          ASSET_CONDITION_LABELS[i.actualCondition] || '',
          i.note,
        ]),
      ),
    ];
    downloadCsv(rows, `${fileBase}.csv`);
  };

  const SignCell = ({ title, role, sig, name }) => (
    <td>
      <div className="ps-sign__title">{title}</div>
      <div className="ps-sign__role">({role})</div>
      <div className="ps-sign__img">
        {sig ? <img src={sig.signatureUrl} alt={`Chữ ký ${sig.signedByName}`} /> : <span className="ps-sign__pending">Chưa ký</span>}
      </div>
      {sig && (
        <>
          <div className="ps-sign__name">{sig.signedByName || name}</div>
          <div>{formatDateTime(sig.signedAt)}</div>
        </>
      )}
    </td>
  );

  return (
    <div className="page">
      <Breadcrumb items={inspectionCrumbs(`Biên bản ${r.code}`)} />
      <div className="row row--between no-print" style={{ margin: '12px 0 16px' }}>
        <button className="btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <PrintToolbar sheetRef={sheetRef} fileBase={fileBase} onCsv={onCsv} printLabel="In biên bản" />
      </div>
      <div className="print-preview__paper">
        <div className="print-sheet" ref={sheetRef}>
          <PrintHeader />
          <div className="ps-title">
            <h1>BIÊN BẢN KIỂM KÊ TÀI SẢN</h1>
            <div>
              Số: <b>{r.code}</b>
            </div>
            <span className={`ps-stamp ps-stamp--${STAMP_TONE[r.status]}`}>{ROUND_STATUS_LABELS[r.status].toUpperCase()}</span>
          </div>

          <div className="ps-section">1. Thông tin chung</div>
          <table className="ps-table ps-table--info">
            <tbody>
              <tr>
                <th>Tên đợt kiểm kê:</th>
                <td>{r.name}</td>
              </tr>
              <tr>
                <th>Loại kiểm kê:</th>
                <td>{ROUND_TYPE_LABELS[r.type]}</td>
              </tr>
              <tr>
                <th>Địa điểm kiểm kê:</th>
                <td>{describeScope(r, md).where}</td>
              </tr>
              <tr>
                <th>Tài sản kiểm kê:</th>
                <td>{describeScope(r, md).what}</td>
              </tr>
              <tr>
                <th>Thời gian:</th>
                <td>
                  {formatDate(r.startDate)} – {formatDate(r.deadline)}
                </td>
              </tr>
              <tr>
                <th>Yêu cầu:</th>
                <td>{r.note || '—'}</td>
              </tr>
              {r.status === ROUND_STATUS.COMPLETED && (
                <tr>
                  <th>Kết luận:</th>
                  <td>
                    {r.approvalNote || '—'}
                    {r.applyAdjustments ? ' (Đã cập nhật số liệu tài sản theo thực tế)' : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="ps-section">2. Tổng hợp theo lớp/phòng</div>
          <table className="ps-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã phiếu</th>
                <th>Lớp/phòng</th>
                <th>Người kiểm kê</th>
                <th>Số tài sản</th>
                <th>Lệch</th>
                <th>Hư hỏng</th>
              </tr>
            </thead>
            <tbody>
              {sheets.map((s, k) => {
                const sum = sheetSummary(s);
                return (
                  <tr key={s.id}>
                    <td className="c">{k + 1}</td>
                    <td className="c">{s.code}</td>
                    <td>{locationLabel(md.locationById(s.locationId))}</td>
                    <td>{md.userById(s.inspectorUserId)?.fullName}</td>
                    <td className="c">{sum.total}</td>
                    <td className="c">{sum.variance}</td>
                    <td className="c">{sum.damaged}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="ps-section">3. Tài sản chênh lệch / hư hỏng</div>
          {variance.length === 0 ? (
            <div style={{ padding: '4px 10px' }}>Không có chênh lệch giữa sổ sách và thực tế.</div>
          ) : (
            <table className="ps-table">
              <thead>
                <tr>
                  <th>Lớp/phòng</th>
                  <th>Tài sản</th>
                  <th>Sổ sách</th>
                  <th>Thực tế</th>
                  <th>Chênh lệch</th>
                  <th>Tình trạng</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {variance.map((i) => (
                  <tr key={`${i.locationId}-${i.assetId}`}>
                    <td>{locationLabel(md.locationById(i.locationId))}</td>
                    <td>{i.assetName}</td>
                    <td className="c">{i.bookQuantity}</td>
                    <td className="c">{i.actualQuantity}</td>
                    <td className="c">
                      {i.actualQuantity - i.bookQuantity > 0 ? `+${i.actualQuantity - i.bookQuantity}` : i.actualQuantity - i.bookQuantity}
                    </td>
                    <td className="c">{ASSET_CONDITION_LABELS[i.actualCondition]}</td>
                    <td>{i.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="ps-section">4. Chữ ký xác nhận</div>
          <table className="ps-table ps-sign">
            <tbody>
              <tr>
                <SignCell title="Người lập" role={ROLE_LABELS.VICE_PRINCIPAL} sig={creator} />
                <SignCell title="Phê duyệt" role={ROLE_LABELS.VICE_PRINCIPAL} sig={approver} />
              </tr>
            </tbody>
          </table>
          <table className="ps-table ps-sign" style={{ marginTop: -1 }}>
            <tbody>
              {Array.from({ length: Math.ceil(sheets.length / 3) }).map((_, row) => (
                <tr key={row}>
                  {sheets.slice(row * 3, row * 3 + 3).map((s) => (
                    <SignCell
                      key={s.id}
                      title="Người kiểm kê"
                      role={locationLabel(md.locationById(s.locationId))}
                      sig={s.inspectorSignature}
                      name={md.userById(s.inspectorUserId)?.fullName}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
