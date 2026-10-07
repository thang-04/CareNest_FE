import { useCallback } from 'react';
import { Pencil, Home, Building2, Info } from 'lucide-react';
import { formatDate, formatFileSize } from '@/utils/format';
import { ROLE_LABELS } from '@/models/User';
import { locationLabel } from '@/models/Location';
import { TRANSFER_TYPE_LABELS, TRANSFER_TYPES } from '@/models/facility-transfer/transferConstants';
import { Avatar } from '@/components/ui/Avatar';
import { AssetThumb, ConditionBadge } from '@/components/asset/AssetVisuals';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { FileUploader } from '@/components/upload/FileUploader';

const EditBtn = ({ onClick }) => (
  <button className="btn btn--sm btn--outline-primary" onClick={onClick}>
    <Pencil size={14} /> Chỉnh sửa
  </button>
);

function PersonBlock({ title, user, location, campus, Icon }) {
  return (
    <div className="person-block">
      <div className="fw-600 mb-8">{title}</div>
      {user ? (
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <Avatar user={user} size="lg" />
          <div style={{ lineHeight: 1.55 }}>
            <div className="fw-600">{user.fullName}</div>
            <div className="text-2">{ROLE_LABELS[user.role]}</div>
            <div className="text-2">{user.phone}</div>
            <div className="text-2">{user.email}</div>
          </div>
        </div>
      ) : (
        <div className="text-danger">Chưa chọn</div>
      )}
      <div className="person-block__loc">
        <Icon size={20} className="text-primary" />
        <div>
          <div>{locationLabel(location)}</div>
          <div className="text-2 text-sm">{campus?.shortName}</div>
        </div>
      </div>
    </div>
  );
}

/** Bước 4 – Xác nhận và gửi (LuanChuyen4 mockup). Read-only summary + creator signature. */
export function StepReview({ wizard, md, lockedCode, mode, changeNote, onChangeNote }) {
  const { form, errors, update, goTo } = wizard;
  const from = md.locationById(form.fromLocationId);
  const to = md.locationById(form.toLocationId);
  const fromCampus = md.campusById(form.fromCampusId);
  const toCampus = md.campusById(form.toCampusId);
  const onSignature = useCallback(({ url, id }) => update({ creatorSignatureUrl: url, creatorSignatureId: id }), [update]);
  const inter = form.type === TRANSFER_TYPES.INTER_CAMPUS;

  return (
    <section className="card wizard-card">
      <h2 className="section-title">4.&nbsp; Xác nhận thông tin và gửi phiếu</h2>
      <div className="review-grid">
        <div className="card review-card">
          <div className="row row--between mb-12">
            <span className="subsection-title" style={{ margin: 0 }}>
              Thông tin chung
            </span>
            <EditBtn onClick={() => goTo(0)} />
          </div>
          <dl className="info-list info-list--wide">
            <dt>Mã phiếu:</dt>
            <dd>{lockedCode || 'Tự động sinh'}</dd>
            <dt>Ngày lập:</dt>
            <dd>{formatDate(form.createdDate)}</dd>
            <dt>Ngày dự kiến bàn giao:</dt>
            <dd>{formatDate(form.expectedHandoverDate)}</dd>
            {inter ? (
              <>
                <dt>Campus đi:</dt>
                <dd>{fromCampus?.name}</dd>
                <dt>Campus đến:</dt>
                <dd>{toCampus?.name}</dd>
              </>
            ) : (
              <>
                <dt>Campus:</dt>
                <dd>{fromCampus?.name}</dd>
              </>
            )}
            <dt>Loại luân chuyển:</dt>
            <dd>{TRANSFER_TYPE_LABELS[form.type]}</dd>
            <dt>Từ:</dt>
            <dd>{locationLabel(from)}</dd>
            <dt>Đến:</dt>
            <dd>{locationLabel(to)}</dd>
            <dt>Lý do:</dt>
            <dd>{form.reason}</dd>
            <dt>Ghi chú:</dt>
            <dd>{form.note || '—'}</dd>
          </dl>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card review-card">
            <div className="row row--between mb-12">
              <span className="subsection-title" style={{ margin: 0 }}>
                Người thực hiện
              </span>
              <EditBtn onClick={() => goTo(2)} />
            </div>
            <div className="grid-2">
              <PersonBlock
                title="Người bàn giao (tại nơi đi)"
                user={md.userById(form.handoverUserId)}
                location={from}
                campus={fromCampus}
                Icon={Home}
              />
              <PersonBlock
                title="Người nhận (tại nơi đến)"
                user={md.userById(form.receiverUserId)}
                location={to}
                campus={toCampus}
                Icon={Building2}
              />
            </div>
          </div>
          <div className="card review-card">
            <div className="row row--between mb-8">
              <span className="subsection-title" style={{ margin: 0 }}>
                Tài liệu đính kèm
              </span>
              <EditBtn onClick={() => goTo(0)} />
            </div>
            {form.attachments.length ? (
              <FileUploader files={form.attachments} onChange={() => {}} disabled />
            ) : (
              <div className="muted">Không có tài liệu đính kèm</div>
            )}
            <span className="sr-only">{form.attachments.map((a) => `${a.name} (${formatFileSize(a.size)})`).join(', ')}</span>
          </div>
        </div>
      </div>

      <div className="card review-card mt-16">
        <div className="row row--between mb-12">
          <span className="subsection-title" style={{ margin: 0 }}>
            Danh sách tài sản luân chuyển
          </span>
          <EditBtn onClick={() => goTo(1)} />
        </div>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th className="center">STT</th>
                <th className="center">Mã tài sản</th>
                <th>Tên tài sản</th>
                <th className="center">Đơn vị</th>
                <th className="center">Số lượng luân chuyển</th>
                <th className="center">Tình trạng</th>
                <th className="center">Hình ảnh</th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((i, idx) => (
                <tr key={i.assetId}>
                  <td className="center">{idx + 1}</td>
                  <td className="center">{i.assetCode}</td>
                  <td>{i.assetName}</td>
                  <td className="center">{i.unit}</td>
                  <td className="center">{i.quantity}</td>
                  <td className="center">
                    <ConditionBadge value={i.condition} />
                  </td>
                  <td className="center">
                    <AssetThumb asset={i} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.items && <div className="field__error mt-8">{errors.items}</div>}
      </div>

      {mode === 'revise' && (
        <div className="card review-card mt-16">
          <label className="subsection-title" htmlFor="change-note" style={{ display: 'block' }}>
            Nội dung điều chỉnh
          </label>
          <textarea
            id="change-note"
            className="textarea"
            rows={3}
            maxLength={500}
            value={changeNote}
            onChange={(e) => onChangeNote(e.target.value)}
            placeholder="Ví dụ: Sửa số lượng ghế nhựa từ 10 xuống 8 theo phản hồi của giáo viên."
          />
        </div>
      )}

      <div className="review-sign mt-16">
        <div style={{ flex: 1 }}>
          <div className="subsection-title">Chữ ký người tạo phiếu (Phó hiệu trưởng)</div>
          <SignaturePicker value={form.creatorSignatureUrl} onChange={onSignature} error={errors.creatorSignature} />
        </div>
        <div className="alert alert--info review-sign__note">
          <Info size={18} />
          <div>
            <div className="fw-600 mb-8">Lưu ý</div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Đây là chữ ký của bạn (PHT) và sẽ được sử dụng cho các phiếu trong tương lai nếu bạn lưu vào tài khoản.</li>
              <li>Bạn có thể cập nhật chữ ký bất kỳ lúc nào trong thông tin cá nhân.</li>
              <li>
                Sau khi gửi, phiếu chuyển sang <b>Chờ bàn giao</b> và người bàn giao nhận thông báo.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
