import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Scale, CheckCircle2, Lock, PackagePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTransfer } from '@/hooks/facility-transfer/useTransfers';
import { useMasterData } from '@/hooks/useMasterData';
import { resolveDiscrepancy } from '@/services/facility-transfer/transferService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { TransferStatusBadge } from '@/components/facility-transfer/TransferStatusBadge';
import { DiscrepancyParts } from '@/components/facility-transfer/DiscrepancyHistoryCard';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { canResolveDiscrepancy } from '@/utils/facility-transfer/transferPermissions';
import { discrepancyParts } from '@/models/facility-transfer/FacilityTransferItem';
import {
  DISCREPANCY_PARTS,
  DISCREPANCY_PART_LABELS,
  PART_CHOICES,
  PART_CHOICE_HINTS,
  RESOLUTION_CHOICES,
  RESOLUTION_CHOICE_LABELS,
} from '@/models/facility-transfer/transferConstants';
import { formatDateTime } from '@/utils/format';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';
import '@/styles/modules/facility-transfer.css';

/** Default choice per problem part: fix it physically (giao thêm / trả lại / đổi). */
const defaultDecisions = (discrepancy) =>
  Object.fromEntries(
    discrepancy.lines.map((l) => {
      const parts = discrepancyParts(l);
      return [l.itemId, Object.fromEntries(DISCREPANCY_PARTS.filter((p) => parts[p] > 0).map((p) => [p, PART_CHOICES[p][0]]))];
    }),
  );

/** Quantity the receiver keeps for one line after the VP's choices. */
const finalQuantity = (line, d) => {
  const parts = discrepancyParts(line);
  return (
    parts.good +
    (d.shortage === RESOLUTION_CHOICES.SUPPLEMENT ? parts.shortage : 0) +
    (d.damaged === RESOLUTION_CHOICES.REPLACE ? parts.damaged : 0) -
    (d.surplus === RESOLUTION_CHOICES.RETURN ? parts.surplus : 0)
  );
};

/** PHT-08: for each missing / extra / damaged part, either ask for a fix or accept what was received. */
export default function TransferDiscrepancyPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { transfer: t, loading, error, reload } = useTransfer(id, { live: false });
  const [decisions, setDecisions] = useState({});
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const discrepancy = t?.discrepancies.find((d) => d.status === 'OPEN');

  useEffect(() => {
    if (discrepancy) setDecisions(defaultDecisions(discrepancy));
  }, [discrepancy?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!canResolveDiscrepancy(t, user) || !discrepancy) {
    return (
      <div className="page">
        <Breadcrumb items={transferCrumbs(`Xử lý chênh lệch ${t.code}`)} />
        <div className="card mt-16">
          <EmptyState
            icon={Lock}
            title="Không có chênh lệch cần xử lý"
            description="Chỉ Phó hiệu trưởng campus gửi tài sản xử lý được, và chỉ khi phiếu ở trạng thái “Chờ xử lý chênh lệch”."
            action={
              <Link className="btn" to={`/facility/transfers/${t.id}`}>
                Xem chi tiết phiếu
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const setChoice = (itemId, part, value) => setDecisions((d) => ({ ...d, [itemId]: { ...d[itemId], [part]: value } }));
  // Any physical fix sends the transfer back to the handover person; otherwise it completes now.
  const tasks = discrepancy.lines
    .map((l) => {
      const d = decisions[l.itemId] || {};
      const parts = discrepancyParts(l);
      const item = t.items.find((i) => i.id === l.itemId);
      const deliver =
        (d.shortage === RESOLUTION_CHOICES.SUPPLEMENT ? parts.shortage : 0) +
        (d.damaged === RESOLUTION_CHOICES.REPLACE ? parts.damaged : 0);
      const takeBack = d.surplus === RESOLUTION_CHOICES.RETURN ? parts.surplus : 0;
      return { name: item?.assetName, deliver, takeBack };
    })
    .filter((x) => x.deliver || x.takeBack);
  const completesNow = tasks.length === 0;
  const handoverName = md.userById(t.handoverUserId)?.fullName;

  const askConfirm = () => {
    if (!note.trim()) {
      setNoteError('Vui lòng nhập nội dung xử lý');
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    try {
      await resolveDiscrepancy(t.id, { note, decisions: Object.entries(decisions).map(([itemId, d]) => ({ itemId, ...d })) }, user);
      toast.success(
        completesNow ? `Phiếu ${t.code} đã hoàn thành theo số lượng thực nhận.` : `Đã gửi yêu cầu cho ${handoverName}.`,
        'Xử lý chênh lệch',
      );
      navigate(`/facility/transfers/${t.id}`);
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err.message, 'Không xử lý được chênh lệch');
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs(`Xử lý chênh lệch ${t.code}`)} />
      <div className="row" style={{ gap: 12 }}>
        <h1 className="page__title">Xử lý chênh lệch - {t.code}</h1>
        <TransferStatusBadge status={t.status} />
      </div>

      <div className="alert alert--purple">
        <Scale size={20} />
        <div>
          <div className="fw-600">
            {md.userById(discrepancy.reportedBy)?.fullName} (người nhận) báo chênh lệch lúc {formatDateTime(discrepancy.reportedAt)}
          </div>
          <div className="mt-8">“{discrepancy.description}”</div>
        </div>
      </div>

      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Chi tiết chênh lệch và cách xử lý</div>
        </div>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Tài sản</th>
                  <th className="center">Cần nhận</th>
                  <th className="center">Thực nhận</th>
                  <th className="center">Trong đó hỏng</th>
                  <th className="center">Vấn đề</th>
                  <th style={{ minWidth: 280 }}>Cách xử lý của PHT</th>
                  <th className="center">Nơi nhận giữ</th>
                </tr>
              </thead>
              <tbody>
                {discrepancy.lines.map((l) => {
                  const item = t.items.find((i) => i.id === l.itemId);
                  const parts = discrepancyParts(l);
                  const d = decisions[l.itemId] || {};
                  return (
                    <tr key={l.itemId}>
                      <td>
                        <div className="fw-600">{item?.assetName}</div>
                        <div className="muted text-xs">{item?.assetCode}</div>
                        {l.note && <div className="text-2 text-xs mt-8">“{l.note}”</div>}
                        {l.images?.length > 0 && (
                          <div className="mt-8">
                            <ImageUploader images={l.images} disabled />
                          </div>
                        )}
                      </td>
                      <td className="center">{l.expectedQuantity ?? l.handoverQuantity}</td>
                      <td className="center fw-600">{l.receivedQuantity}</td>
                      <td className="center">{parts.damaged}</td>
                      <td className="center">
                        <DiscrepancyParts line={l} />
                      </td>
                      <td>
                        <div className="stack" style={{ gap: 12 }}>
                          {DISCREPANCY_PARTS.filter((p) => parts[p] > 0).map((p) => (
                            <fieldset key={p} className="disc-choice">
                              <legend className="fw-600 text-sm">
                                {DISCREPANCY_PART_LABELS[p]} {parts[p]}
                              </legend>
                              <div className="row row--wrap" style={{ gap: 16 }}>
                                {PART_CHOICES[p].map((c) => (
                                  <label key={c} className="radio">
                                    <input
                                      type="radio"
                                      name={`${l.itemId}-${p}`}
                                      checked={d[p] === c}
                                      onChange={() => setChoice(l.itemId, p, c)}
                                    />
                                    {c === RESOLUTION_CHOICES.ACCEPT
                                      ? RESOLUTION_CHOICE_LABELS[c]
                                      : `${RESOLUTION_CHOICE_LABELS[c]} ${parts[p]}`}
                                  </label>
                                ))}
                              </div>
                              <div className="muted text-xs mt-8">{PART_CHOICE_HINTS[p][d[p]]}</div>
                            </fieldset>
                          ))}
                        </div>
                      </td>
                      <td className="center fw-600">{finalQuantity(l, d)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="field mt-16">
            <label className="field__label" htmlFor="resolve-note">
              Nội dung xử lý<span className="req">*</span>
            </label>
            <textarea
              id="resolve-note"
              className={`textarea ${noteError ? 'textarea--error' : ''}`}
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError('');
              }}
              placeholder="Ví dụ: Cô An mang thêm 1 bàn và lấy về 1 ghế giao thừa."
            />
            {noteError && <span className="field__error">{noteError}</span>}
          </div>

          <div className={`alert ${completesNow ? 'alert--success' : 'alert--info'} mt-16`}>
            {completesNow ? <CheckCircle2 size={18} /> : <PackagePlus size={18} />}
            <div>
              {completesNow ? (
                'Tất cả đều “Chấp nhận”: phiếu hoàn thành ngay theo số nơi nhận giữ (cột bên phải) và tồn kho được cập nhật.'
              ) : (
                <>
                  {handoverName} sẽ nhận thông báo:{' '}
                  {tasks
                    .map(
                      (x) =>
                        `${x.name}: ${[x.deliver && `giao thêm ${x.deliver}`, x.takeBack && `lấy về ${x.takeBack}`].filter(Boolean).join(', ')}`,
                    )
                    .join('; ')}
                  . Làm xong và ký, người nhận kiểm tra và xác nhận thì phiếu hoàn thành.
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="page-actions">
        <button className="btn btn--lg" onClick={() => navigate(`/facility/transfers/${t.id}`)}>
          <ArrowLeft size={17} /> Quay lại
        </button>
        <button className="btn btn--lg btn--primary" onClick={askConfirm}>
          <Scale size={18} /> Xác nhận xử lý
        </button>
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title="Xác nhận cách xử lý chênh lệch?"
        message={
          completesNow
            ? 'Phiếu sẽ hoàn thành ngay và tồn kho được cập nhật theo số lượng thực nhận. Thao tác này không thể hoàn tác.'
            : `${handoverName} sẽ được yêu cầu giao thêm / lấy lại, sau đó người nhận xác nhận.`
        }
        confirmLabel={completesNow ? 'Chấp nhận và hoàn thành' : 'Gửi yêu cầu'}
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
