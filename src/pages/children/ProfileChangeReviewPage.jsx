import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button, ConfirmationModal, DataTable, ListPage, Modal, TextAreaField } from '@/components';
import { DeclarationSummary } from '@/components/children/DeclarationSummary';
import { ProfileChangeStatusBadge } from '@/components/children/ChildBadges';
import { useProfileChanges } from '@/hooks/children/useChildRecords';
import { approveProfileChange, rejectProfileChange } from '@/services/children/childrenService';
import { PROFILE_CHANGE_KIND, PROFILE_CHANGE_KIND_LABELS } from '@/models/children/childrenConstants';
import { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationships';
import { GENDER_LABELS } from '@/models/School';
import { formatDate, formatDateTime } from '@/utils/format';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';

const MAX_NOTE = 500;

/** Nội dung GV đề xuất (BE trả nguyên body đã gửi); người duyệt so với hồ sơ hiện tại qua link "Xem hồ sơ". */
function ProposalDetail({ request }) {
  if (request.kind === PROFILE_CHANGE_KIND.HEALTH_DECLARATION) {
    const body = request.declaration || {};
    return (
      <>
        <DeclarationSummary declaration={body.declaration} title="Khai báo đề xuất" />
        {body.reason && <p className="mt-16">Lý do: {body.reason}</p>}
      </>
    );
  }
  const body = request.profile || {};
  const child = body.child || {};
  return (
    <dl className="tr-proposal">
      <dt>Họ tên</dt>
      <dd>{child.fullName}</dd>
      <dt>Ngày sinh</dt>
      <dd>{child.dateOfBirth ? formatDate(child.dateOfBirth) : '—'}</dd>
      <dt>Giới tính</dt>
      <dd>{GENDER_LABELS[child.gender] || '—'}</dd>
      <dt>Người giám hộ</dt>
      <dd>
        {(child.guardians || []).map((g) => (
          <div key={`${g.fullName}-${g.phone}`}>
            {g.fullName} · {GUARDIAN_RELATIONSHIP_LABELS[g.relation] || g.relation} · {g.phone}
          </div>
        ))}
      </dd>
      <dt>Lý do</dt>
      <dd>{body.reason || '—'}</dd>
    </dl>
  );
}

/** BE:CHD-11 — HT, PHT điểm trường duyệt/từ chối yêu cầu sửa hồ sơ, khai báo sức khỏe do GV gửi. */
export default function ProfileChangeReviewPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { requests, loading, error, reload } = useProfileChanges('PENDING');
  const [viewing, setViewing] = useState(null);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);

  const approve = async () => {
    try {
      await approveProfileChange(approving.id, user);
      toast.success(`Đã duyệt, hồ sơ của ${approving.childName} đã cập nhật.`);
      setApproving(null);
      setViewing(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Không duyệt được yêu cầu');
    }
  };

  const reject = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      setNoteError('Nhập lý do từ chối');
      return;
    }
    setBusy(true);
    try {
      await rejectProfileChange(rejecting.id, trimmed, user);
      toast.success('Đã từ chối yêu cầu, giáo viên nhận được lý do.');
      setRejecting(null);
      setViewing(null);
      reload({ silent: true });
    } catch (err) {
      if (err.details?.note) setNoteError(err.details.note);
      toast.error(err, 'Không từ chối được yêu cầu');
    } finally {
      setBusy(false);
    }
  };

  const openReject = (request) => {
    setNote('');
    setNoteError('');
    setRejecting(request);
  };

  const columns = [
    { key: 'stt', header: 'STT', className: 'center', render: (r) => requests.indexOf(r) + 1 },
    { key: 'child', header: 'Trẻ', render: (r) => `${r.childName} · ${r.childCode}` },
    { key: 'class', header: 'Lớp', render: (r) => r.className || '—' },
    { key: 'kind', header: 'Nội dung', render: (r) => PROFILE_CHANGE_KIND_LABELS[r.kind] },
    { key: 'by', header: 'Giáo viên gửi', render: (r) => r.requestedByName || '—' },
    { key: 'at', header: 'Lúc gửi', render: (r) => formatDateTime(r.requestedAt) },
    { key: 'status', header: 'Trạng thái', render: (r) => <ProfileChangeStatusBadge status={r.status} /> },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'cell--actions',
      render: (r) =>
        r.canDecide && (
          <div className="row gap-2">
            <Button size="sm" variant="primary" icon={Check} onClick={() => setApproving(r)}>
              Duyệt
            </Button>
            <Button size="sm" icon={X} onClick={() => openReject(r)}>
              Từ chối
            </Button>
          </div>
        ),
    },
  ];

  return (
    <ListPage crumbs={childrenCrumbs('Yêu cầu sửa hồ sơ')} title="Yêu cầu sửa hồ sơ chờ duyệt">
      <DataTable
        columns={columns}
        rows={requests}
        loading={loading}
        error={error}
        onRetry={reload}
        onRowClick={setViewing}
        empty={{ title: 'Không có yêu cầu chờ duyệt', description: 'Yêu cầu giáo viên gửi khi sửa hồ sơ trẻ sẽ hiện ở đây.' }}
      />

      <Modal
        open={!!viewing}
        title={viewing ? `${PROFILE_CHANGE_KIND_LABELS[viewing.kind]}: ${viewing.childName}` : ''}
        onClose={() => setViewing(null)}
        size="lg"
        footer={
          viewing && (
            <>
              <Link className="btn" to={`/children/${viewing.childId}`}>
                Xem hồ sơ hiện tại
              </Link>
              {viewing.canDecide && (
                <>
                  <Button icon={X} onClick={() => openReject(viewing)}>
                    Từ chối
                  </Button>
                  <Button variant="primary" icon={Check} onClick={() => setApproving(viewing)}>
                    Duyệt
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        {viewing && (
          <>
            <p className="muted text-sm">
              {viewing.requestedByName} gửi lúc {formatDateTime(viewing.requestedAt)}
            </p>
            <ProposalDetail request={viewing} />
          </>
        )}
      </Modal>

      <ConfirmationModal
        open={!!approving}
        title="Duyệt yêu cầu sửa hồ sơ"
        message={approving ? `Hồ sơ của ${approving.childName} sẽ cập nhật theo đề xuất của ${approving.requestedByName}.` : ''}
        confirmLabel="Duyệt"
        onConfirm={approve}
        onClose={() => setApproving(null)}
      />

      <Modal
        open={!!rejecting}
        title="Từ chối yêu cầu sửa hồ sơ"
        size="sm"
        onClose={busy ? undefined : () => setRejecting(null)}
        footer={
          <>
            <Button onClick={() => setRejecting(null)} disabled={busy}>
              Quay lại
            </Button>
            <Button variant="danger" onClick={reject} loading={busy}>
              Từ chối
            </Button>
          </>
        }
      >
        <TextAreaField
          label="Lý do từ chối"
          required
          rows={3}
          maxLength={MAX_NOTE}
          value={note}
          error={noteError}
          onChange={(e) => {
            setNote(e.target.value);
            setNoteError('');
          }}
        />
      </Modal>
    </ListPage>
  );
}
