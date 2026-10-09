import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, Send, Plus, Trash2, ListPlus, Info, Lock, ArrowLeft } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useProposal, useProposalSources } from '@/hooks/facility/useFacility';
import { saveProposalDraft, submitProposal } from '@/services/facility/facilityService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { IssueTypeChip } from '@/components/facility/FacilityBadges';
import { locationLabel } from '@/models/Location';
import {
  PROPOSAL_ACTIONS,
  PROPOSAL_ACTION_LABELS,
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  ISSUE_TYPES,
} from '@/models/facility/facilityConstants';
import { validateProposal, hasErrors } from '@/utils/facility/facilityValidation';
import { canCreateProposal, canEditProposal } from '@/utils/facility/facilityPermissions';
import { proposalCrumbs } from '@/utils/facility/breadcrumbs';
import { formatMoney, proposalTotal } from '@/utils/facility/facilityFormat';
import { formatDate } from '@/utils/format';
import { uid } from '@/utils/id';
import '@/styles/modules/facility.css';

const EMPTY = { title: '', action: PROPOSAL_ACTIONS.PURCHASE, reason: '', lines: [] };

const lineFromSource = (s) => ({
  id: uid('fpl'),
  sourceType: s.sourceType,
  sourceId: s.sourceId,
  sourceCode: s.sourceCode,
  itemName: s.itemName,
  unit: s.unit,
  locationId: s.locationId,
  quantity: String(s.quantity),
  estimatedCost: '',
  note: '',
});

const manualLine = () => ({
  id: uid('fpl'),
  sourceType: SOURCE_TYPES.MANUAL,
  sourceId: null,
  sourceCode: null,
  itemName: '',
  unit: 'Cái',
  locationId: '',
  quantity: '1',
  estimatedCost: '',
  note: '',
});

/** #120 Facility Proposal Form: the VP consolidates approved reports / requests into a purchase or repair proposal for the Principal. */
export default function ProposalFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { proposal, loading: pLoading, error: pError, reload: pReload } = useProposal(id, { live: false });
  const { sources, loading: sLoading, error: sError, reload: sReload } = useProposalSources(id || null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const initialized = useRef(false);

  // Fill the form once: from the draft being edited, or from the report / request the VP came from.
  useEffect(() => {
    if (initialized.current || sLoading || md.loading || (id && pLoading)) return;
    if (id) {
      if (!proposal) return;
      setForm({
        title: proposal.title,
        action: proposal.action,
        reason: proposal.reason,
        lines: proposal.lines.map((l) => ({
          ...l,
          quantity: String(l.quantity),
          estimatedCost: l.estimatedCost === null ? '' : String(l.estimatedCost),
        })),
      });
    } else {
      const from = sources.find((s) => s.sourceId === params.get('issueId') || s.sourceId === params.get('requestId'));
      if (from) {
        const repair = from.sourceType === SOURCE_TYPES.ISSUE && from.issueType === ISSUE_TYPES.DAMAGED;
        setForm({
          ...EMPTY,
          action: repair ? PROPOSAL_ACTIONS.REPAIR : PROPOSAL_ACTIONS.PURCHASE,
          title: `${repair ? 'Sửa chữa' : 'Mua bổ sung'} ${from.itemName.toLowerCase()} – ${locationLabel(md.locationById(from.locationId))}`,
          lines: [lineFromSource(from)],
        });
      }
    }
    initialized.current = true;
  }, [id, proposal, pLoading, sources, sLoading, params, md]);

  const usedSourceIds = useMemo(() => new Set(form.lines.map((l) => l.sourceId).filter(Boolean)), [form.lines]);
  const freeSources = sources.filter((s) => !usedSourceIds.has(s.sourceId));
  const campusLocations = md.locations.filter((l) => l.campusId === user.campusId);
  const total = proposalTotal(form.lines);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const setLine = (lineId, patch) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }));
    setErrors((e) => {
      const next = { ...e };
      delete next[`line_${lineId}`];
      delete next.lines;
      return next;
    });
  };
  const removeLine = (lineId) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.id !== lineId) }));
  const addPicked = () => {
    const add = sources.filter((s) => picked.includes(s.sourceId)).map(lineFromSource);
    setForm((f) => ({ ...f, lines: [...f.lines, ...add] }));
    setErrors((e) => {
      const next = { ...e };
      delete next.lines;
      return next;
    });
    setPicked([]);
    setPickerOpen(false);
  };

  const payload = () => ({ ...form, lines: form.lines.map((l) => ({ ...l })) });

  const saveDraft = async () => {
    const e = validateProposal(form);
    setErrors(e);
    if (hasErrors(e)) {
      toast.error('Vui lòng kiểm tra các ô được đánh dấu.', 'Chưa lưu được nháp');
      return;
    }
    setBusy('draft');
    try {
      const saved = await saveProposalDraft(id, payload(), user);
      toast.success(`Đã lưu nháp đề xuất ${saved.code}.`);
      if (!id) navigate(`/facility/proposals/${saved.id}/edit`, { replace: true });
    } catch (err) {
      toast.error(err.message, 'Không lưu được nháp');
    } finally {
      setBusy(null);
    }
  };

  const askSubmit = () => {
    const e = validateProposal(form, { forSubmit: true });
    setErrors(e);
    if (hasErrors(e)) {
      toast.error('Vui lòng kiểm tra các ô được đánh dấu.', 'Chưa gửi được đề xuất');
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    setBusy('submit');
    try {
      const sent = await submitProposal(id, payload(), user);
      setConfirmOpen(false);
      toast.success(`Đã gửi đề xuất ${sent.code} tới Hiệu trưởng.`, 'Gửi đề xuất thành công');
      navigate(`/facility/proposals/${sent.id}`);
    } catch (err) {
      toast.error(err.message, 'Không gửi được đề xuất');
    } finally {
      setBusy(null);
    }
  };

  const title = id ? `Sửa đề xuất ${proposal?.code || ''}` : 'Lập đề xuất';
  if (!canCreateProposal(user) || (proposal && !canEditProposal(proposal, user)))
    return (
      <div className="page">
        <Breadcrumb items={proposalCrumbs(title)} />
        <EmptyState
          icon={Lock}
          title="Không sửa được đề xuất này"
          description="Chỉ Phó hiệu trưởng lập đề xuất, và chỉ sửa được bản nháp của chính mình."
        />
      </div>
    );
  if (sLoading || md.loading || (id && pLoading))
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (pError || sError)
    return (
      <div className="page">
        <Breadcrumb items={proposalCrumbs(title)} />
        <ErrorState
          error={pError || sError}
          onRetry={() => {
            pReload();
            sReload();
          }}
        />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={proposalCrumbs(title)} />
      <h1 className="page__title">{id ? `Đề xuất ${proposal?.code} (bản nháp)` : 'Lập đề xuất mua sắm, sửa chữa'}</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Tổng hợp các báo cáo sự cố và đề nghị bổ sung <b>đã duyệt</b> của {md.campusById(user.campusId)?.shortName} thành một đề xuất gửi
          Hiệu trưởng phê duyệt. Duyệt báo cáo và phê duyệt đề xuất là hai bước riêng; mua sắm, thanh toán thực hiện ngoài hệ thống.
        </div>
      </div>

      <section className="card wizard-card">
        <h2 className="section-title">1.&nbsp; Thông tin đề xuất</h2>
        <div className="grid-2">
          <FormField label="Tên đề xuất" required error={errors.title}>
            <input
              className="input"
              maxLength={150}
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Ví dụ: Mua bổ sung thảm xốp tháng 10"
            />
          </FormField>
          <div className="field">
            <span className="field__label" id="bh-action-label">
              Hình thức<span className="req">*</span>
            </span>
            <div className="row row--wrap" style={{ gap: 16, minHeight: 38 }} role="radiogroup" aria-labelledby="bh-action-label">
              {Object.values(PROPOSAL_ACTIONS).map((a) => (
                <label key={a} className="radio">
                  <input type="radio" name="bh-action" checked={form.action === a} onChange={() => set({ action: a })} />{' '}
                  {PROPOSAL_ACTION_LABELS[a]}
                </label>
              ))}
            </div>
            {errors.action && (
              <span className="field__error" role="alert">
                {errors.action}
              </span>
            )}
          </div>
        </div>
        <FormField className="mt-12" label="Lý do / căn cứ đề xuất" required error={errors.reason} hint="Bắt buộc khi gửi Hiệu trưởng">
          <textarea
            className="textarea"
            rows={3}
            maxLength={1000}
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder="Ví dụ: Tổng hợp báo cáo thiếu số lượng đã duyệt trong tháng 9"
          />
        </FormField>
      </section>

      <section className="card wizard-card">
        <div className="row row--between row--wrap" style={{ gap: 8 }}>
          <h2 className="section-title">2.&nbsp; Tài sản đề xuất</h2>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, manualLine()] }))}>
              <Plus size={16} /> Thêm dòng
            </button>
            <button
              className="btn btn--outline-primary"
              onClick={() => {
                setPicked([]);
                setPickerOpen(true);
              }}
            >
              <ListPlus size={16} /> Thêm từ báo cáo đã duyệt ({freeSources.length})
            </button>
          </div>
        </div>
        {errors.lines && (
          <div className="field__error mt-8" role="alert">
            {errors.lines}
          </div>
        )}
        {form.lines.length === 0 ? (
          <EmptyState
            icon={ListPlus}
            title="Chưa có tài sản trong đề xuất"
            description="Thêm từ các báo cáo sự cố / đề nghị bổ sung đã duyệt, hoặc thêm dòng nhập tay."
          />
        ) : (
          <div className="table-wrap mt-12">
            <table className="table table--compact bh-lines">
              <thead>
                <tr>
                  <th>Nguồn</th>
                  <th style={{ minWidth: 180 }}>
                    Tài sản<span className="req">*</span>
                  </th>
                  <th style={{ minWidth: 170 }}>Lớp/phòng</th>
                  <th className="center">
                    SL<span className="req">*</span>
                  </th>
                  <th>ĐVT</th>
                  <th className="right">Dự toán (đ)</th>
                  <th style={{ minWidth: 150 }}>Ghi chú</th>
                  <th className="center">
                    <span className="sr-only">Xóa</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l, idx) => {
                  const manual = l.sourceType === SOURCE_TYPES.MANUAL;
                  const err = errors[`line_${l.id}`];
                  return (
                    <tr key={l.id}>
                      <td className="nowrap">
                        {manual ? (
                          <span className="chip chip--gray">{SOURCE_TYPE_LABELS.MANUAL}</span>
                        ) : (
                          <span className="chip chip--blue" title={SOURCE_TYPE_LABELS[l.sourceType]}>
                            {l.sourceCode}
                          </span>
                        )}
                      </td>
                      <td>
                        {manual ? (
                          <input
                            className={`input ${err && !l.itemName.trim() ? 'input--error' : ''}`}
                            value={l.itemName}
                            maxLength={120}
                            aria-label={`Tên tài sản dòng ${idx + 1}`}
                            onChange={(e) => setLine(l.id, { itemName: e.target.value })}
                          />
                        ) : (
                          <span className="fw-600">{l.itemName}</span>
                        )}
                        {err && (
                          <div className="field__error text-xs" role="alert">
                            {err}
                          </div>
                        )}
                      </td>
                      <td>
                        {manual ? (
                          <select
                            className="select"
                            value={l.locationId || ''}
                            aria-label={`Lớp/phòng dòng ${idx + 1}`}
                            onChange={(e) => setLine(l.id, { locationId: e.target.value })}
                          >
                            <option value="">Dùng chung campus</option>
                            {campusLocations.map((loc) => (
                              <option key={loc.id} value={loc.id}>
                                {locationLabel(loc)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          locationLabel(md.locationById(l.locationId))
                        )}
                      </td>
                      <td className="center">
                        <input
                          className="input bh-lines__qty"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={l.quantity}
                          aria-label={`Số lượng dòng ${idx + 1}`}
                          onChange={(e) => setLine(l.id, { quantity: e.target.value })}
                        />
                      </td>
                      <td>
                        {manual ? (
                          <input
                            className="input bh-lines__qty"
                            value={l.unit}
                            maxLength={20}
                            aria-label={`Đơn vị tính dòng ${idx + 1}`}
                            onChange={(e) => setLine(l.id, { unit: e.target.value })}
                          />
                        ) : (
                          l.unit
                        )}
                      </td>
                      <td className="right">
                        <input
                          className="input bh-lines__cost"
                          type="number"
                          min={0}
                          step={1000}
                          inputMode="numeric"
                          value={l.estimatedCost}
                          aria-label={`Dự toán dòng ${idx + 1}`}
                          onChange={(e) => setLine(l.id, { estimatedCost: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          value={l.note}
                          maxLength={200}
                          aria-label={`Ghi chú dòng ${idx + 1}`}
                          onChange={(e) => setLine(l.id, { note: e.target.value })}
                        />
                      </td>
                      <td className="center">
                        <button className="icon-btn" title="Xóa dòng" aria-label={`Xóa dòng ${idx + 1}`} onClick={() => removeLine(l.id)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="bh-total">
              <span>Tổng dự toán:</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        )}
      </section>

      <div className="page-actions">
        <button className="btn btn--lg" onClick={() => navigate('/facility/proposals')}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn--lg" onClick={saveDraft} disabled={!!busy}>
            {busy === 'draft' ? <Spinner small /> : <Save size={16} />} Lưu nháp
          </button>
          <button className="btn btn--lg btn--primary" onClick={askSubmit} disabled={!!busy}>
            <Send size={16} /> Gửi Hiệu trưởng
          </button>
        </div>
      </div>

      <Modal
        open={pickerOpen}
        size="lg"
        title="Thêm từ báo cáo / đề nghị đã duyệt"
        onClose={() => setPickerOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setPickerOpen(false)}>
              Quay lại
            </button>
            <button className="btn btn--primary" onClick={addPicked} disabled={!picked.length}>
              <ListPlus size={16} /> Thêm {picked.length || ''} mục
            </button>
          </>
        }
      >
        {freeSources.length === 0 ? (
          <EmptyState
            title="Không còn mục nào để thêm"
            description="Chỉ báo cáo sự cố và đề nghị bổ sung đã duyệt, chưa nằm trong đề xuất khác mới được thêm."
          />
        ) : (
          freeSources.map((s) => {
            const on = picked.includes(s.sourceId);
            return (
              <label key={s.sourceId} className={`bh-source ${on ? 'bh-source--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setPicked((p) => (on ? p.filter((x) => x !== s.sourceId) : [...p, s.sourceId]))}
                />
                <span className="bh-source__body">
                  <span className="row row--wrap" style={{ gap: 8 }}>
                    <b>{s.sourceCode}</b>
                    {s.issueType ? (
                      <IssueTypeChip type={s.issueType} />
                    ) : (
                      <span className="chip chip--blue">{SOURCE_TYPE_LABELS.REQUEST}</span>
                    )}
                    <span>
                      {s.itemName} · {s.quantity} {s.unit.toLowerCase()}
                    </span>
                  </span>
                  <span className="text-sm text-2" style={{ display: 'block' }}>
                    {locationLabel(md.locationById(s.locationId))} · duyệt {formatDate(s.decidedAt)}
                  </span>
                  <span className="text-sm muted" style={{ display: 'block' }}>
                    {s.description}
                  </span>
                </span>
              </label>
            );
          })
        )}
      </Modal>

      <ConfirmationModal
        open={confirmOpen}
        title="Gửi đề xuất tới Hiệu trưởng?"
        message={`${PROPOSAL_ACTION_LABELS[form.action]}: ${form.title.trim()} – ${form.lines.length} tài sản, tổng dự toán ${formatMoney(
          total,
        )}. Sau khi gửi, đề xuất không sửa được nữa; Hiệu trưởng nhận thông báo để phê duyệt.`}
        confirmLabel="Gửi đề xuất"
        onConfirm={submit}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
