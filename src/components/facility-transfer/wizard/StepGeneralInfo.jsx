import { useCallback } from 'react';
import { Info, Lock } from '@/components/ui/icons';
import { useLockedLocations } from '@/hooks/useLockedLocations';
import { TRANSFER_TYPES, TRANSFER_TYPE_LABELS, TRANSFER_TYPE_LOCATION_TYPES } from '@/models/facility-transfer/transferConstants';
import { ROLE_LABELS } from '@/models/User';
import { formatDateTime } from '@/utils/format';
import { CampusPicker, CampusInfoCard } from '@/components/facility-transfer/CampusPicker';
import { LocationPicker } from '@/components/facility-transfer/LocationPicker';
import { FileUploader } from '@/components/upload/FileUploader';
import { SignaturePicker } from '@/components/signature/SignaturePicker';

const Field = ({ label, required, error, children, htmlFor, inline = true }) => (
  <div className={inline ? 'form-row' : 'field'}>
    <label className="form-row__label" htmlFor={htmlFor}>
      {label}
      {required && <span className="req">*</span>}
    </label>
    <div className="form-row__control">
      {children}
      {error && <div className="field__error">{error}</div>}
    </div>
  </div>
);

function TextArea({ id, value, onChange, error, placeholder, rows = 3 }) {
  return (
    <>
      <textarea
        id={id}
        className={`textarea ${error ? 'textarea--error' : ''}`}
        rows={rows}
        maxLength={500}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="char-count">{value.length}/500</div>
    </>
  );
}

/** Bước 1 – Thông tin chung (LuanChuyen1 + LuanChuyenCampus mockups). */
export function StepGeneralInfo({ wizard, md, user, lockedCode }) {
  // GBR-FAC-06: assets are sent only from the campus of the Vice Principal.
  const ownCampuses = md.campuses.filter((c) => c.id === user.campusId);
  const { form, errors, update } = wizard;
  const inter = form.type === TRANSFER_TYPES.INTER_CAMPUS;
  const allowed = TRANSFER_TYPE_LOCATION_TYPES[form.type];
  const onSignature = useCallback(({ url, id }) => update({ creatorSignatureUrl: url, creatorSignatureId: id }), [update]);
  const locked = useLockedLocations();
  const lockedPicked = [form.fromLocationId, form.toLocationId].filter((l) => l && locked[l]);

  const typeRadios = (
    <div className="stack" style={{ gap: 10 }} role="radiogroup" aria-label="Loại luân chuyển">
      {Object.values(TRANSFER_TYPES).map((t) => (
        <label key={t} className="radio">
          <input type="radio" name="transfer-type" checked={form.type === t} onChange={() => update({ type: t })} />
          {TRANSFER_TYPE_LABELS[t]}
        </label>
      ))}
    </div>
  );

  const codeInput = <input className="input" readOnly value={lockedCode || 'Tự động sinh'} aria-label="Mã phiếu" />;
  const dates = (
    <>
      <Field label="Ngày lập" htmlFor="createdDate">
        <input id="createdDate" type="date" className="input" value={form.createdDate} readOnly aria-describedby="createdDateHint" />
        <div id="createdDateHint" className="field__hint">
          Hệ thống ghi ngày gửi phiếu
        </div>
      </Field>
      <Field label="Ngày dự kiến bàn giao" required error={errors.expectedHandoverDate} htmlFor="expectedDate">
        <input
          id="expectedDate"
          type="date"
          className={`input ${errors.expectedHandoverDate ? 'input--error' : ''}`}
          value={form.expectedHandoverDate}
          min={form.createdDate}
          onChange={(e) => update({ expectedHandoverDate: e.target.value })}
        />
      </Field>
    </>
  );
  const reason = (
    <Field label="Lý do" required error={errors.reason} htmlFor="reason">
      <TextArea
        id="reason"
        value={form.reason}
        onChange={(v) => update({ reason: v })}
        error={errors.reason}
        placeholder="Nhập lý do luân chuyển..."
      />
    </Field>
  );
  const note = (
    <Field label="Ghi chú" error={errors.note} htmlFor="note">
      <TextArea id="note" value={form.note} onChange={(v) => update({ note: v })} rows={2} placeholder="Ghi chú thêm (nếu có)" />
    </Field>
  );

  return (
    <>
      <section className="card wizard-card">
        <h2 className="section-title">1.&nbsp; Thông tin chung</h2>
        {lockedPicked.length > 0 && (
          <div className="alert alert--warning mb-16">
            <Lock size={18} />
            <div>
              {lockedPicked.map((l) => `${md.locationById(l)?.name} đang kiểm kê (đợt ${locked[l]})`).join('; ')}. Bạn vẫn lưu nháp được,
              nhưng chỉ gửi phiếu khi đợt kiểm kê hoàn thành.
            </div>
          </div>
        )}
        {!inter ? (
          <div className="general-grid">
            <div>
              <Field label="Mã phiếu" required>
                {codeInput}
              </Field>
              {dates}
              <Field label="Loại luân chuyển" required error={errors.type}>
                {typeRadios}
              </Field>
            </div>
            <div>
              <Field label="Campus" required error={errors.fromCampusId} htmlFor="campus">
                <CampusPicker id="campus" campuses={ownCampuses} value={form.fromCampusId} onChange={(v) => update({ fromCampusId: v })} />
              </Field>
              <Field label="Từ (lớp/phòng)" required htmlFor="fromLoc">
                <LocationPicker
                  id="fromLoc"
                  locations={md.locations}
                  campusId={form.fromCampusId}
                  allowedTypes={allowed}
                  value={form.fromLocationId}
                  onChange={(v) => update({ fromLocationId: v })}
                  error={errors.fromLocationId}
                />
              </Field>
              <Field label="Đến (lớp/phòng)" required htmlFor="toLoc">
                <LocationPicker
                  id="toLoc"
                  locations={md.locations}
                  campusId={form.toCampusId}
                  allowedTypes={allowed}
                  value={form.toLocationId}
                  excludeId={form.fromLocationId}
                  onChange={(v) => update({ toLocationId: v })}
                  error={errors.toLocationId}
                />
              </Field>
              {reason}
              {note}
            </div>
          </div>
        ) : (
          <div className="general-grid general-grid--inter">
            <div>
              <Field label="Loại luân chuyển" required error={errors.type}>
                {typeRadios}
              </Field>
              <Field label="Mã phiếu">{codeInput}</Field>
              {dates}
              {reason}
            </div>
            <div>
              <div className="alert alert--info mb-16">
                <Info size={20} />
                <div>
                  Luân chuyển giữa các campus là việc di chuyển tài sản từ một campus sang campus khác trong hệ thống.
                  <br />
                  Vui lòng chọn campus đi và campus đến.
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="fromCampus">
                    Campus đi<span className="req">*</span>
                  </label>
                  <CampusPicker
                    id="fromCampus"
                    campuses={ownCampuses}
                    value={form.fromCampusId}
                    onChange={(v) => update({ fromCampusId: v })}
                    error={errors.fromCampusId}
                  />
                  <CampusInfoCard campus={md.campusById(form.fromCampusId)} />
                  <label className="field__label mt-8" htmlFor="fromLoc2">
                    Từ lớp/phòng<span className="req">*</span>
                  </label>
                  <LocationPicker
                    id="fromLoc2"
                    locations={md.locations}
                    campusId={form.fromCampusId}
                    allowedTypes={allowed}
                    value={form.fromLocationId}
                    onChange={(v) => update({ fromLocationId: v })}
                    error={errors.fromLocationId}
                  />
                  {form.fromCampusId && <div className="field__hint">Thuộc: {md.campusById(form.fromCampusId)?.shortName}</div>}
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="toCampus">
                    Campus đến<span className="req">*</span>
                  </label>
                  <CampusPicker
                    id="toCampus"
                    campuses={md.campuses.filter((c) => c.id !== form.fromCampusId)}
                    value={form.toCampusId}
                    onChange={(v) => update({ toCampusId: v })}
                    error={errors.toCampusId}
                  />
                  <CampusInfoCard campus={md.campusById(form.toCampusId)} tone="green" />
                  <label className="field__label mt-8" htmlFor="toLoc2">
                    Đến lớp/phòng<span className="req">*</span>
                  </label>
                  <LocationPicker
                    id="toLoc2"
                    locations={md.locations}
                    campusId={form.toCampusId}
                    allowedTypes={allowed}
                    value={form.toLocationId}
                    onChange={(v) => update({ toLocationId: v })}
                    error={errors.toLocationId}
                  />
                  {form.toCampusId && <div className="field__hint">Thuộc: {md.campusById(form.toCampusId)?.shortName}</div>}
                </div>
              </div>
              <div className="mt-16">{note}</div>
            </div>
          </div>
        )}
      </section>

      <div className="wizard-bottom-grid">
        <section className="card wizard-card">
          <h3 className="subsection-title text-lg">Tài liệu đính kèm (nếu có)</h3>
          <FileUploader files={form.attachments} onChange={(attachments) => update({ attachments })} />
        </section>
        <section className="card wizard-card">
          <h3 className="subsection-title text-lg">Người tạo phiếu</h3>
          <div className="form-row">
            <label className="form-row__label">
              Người tạo<span className="req">*</span>
            </label>
            <input className="input" readOnly value={`${user.fullName} (${ROLE_LABELS[user.role]})`} aria-label="Người tạo" />
          </div>
          <div className="form-row">
            <label className="form-row__label">
              Ngày tạo<span className="req">*</span>
            </label>
            <input className="input" readOnly value={formatDateTime(new Date().toISOString())} aria-label="Ngày tạo" />
          </div>
          <div className="form-row form-row--top">
            <label className="form-row__label">
              Chữ ký người tạo<span className="req">*</span>
            </label>
            <div className="form-row__control">
              <SignaturePicker value={form.creatorSignatureUrl} onChange={onSignature} error={errors.creatorSignature} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
