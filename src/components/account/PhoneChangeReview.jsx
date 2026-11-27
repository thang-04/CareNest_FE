import { useState } from 'react';
import { Button, ConfirmationModal, DataTable, Modal, TextAreaField } from '@/components';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { approvePhoneChange, listPhoneChangeRequests, rejectPhoneChange } from '@/services/account/guardianService';

export function PhoneChangeReview({ onChanged }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => listPhoneChangeRequests('PENDING', user), [user], { refreshOnDataChange: true });
  const [rejecting, setRejecting] = useState(null);
  const [approving, setApproving] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (row, rejectingRequest) => {
    if (busy || (rejectingRequest && !note.trim())) return;
    setBusy(true);
    try {
      if (rejectingRequest) await rejectPhoneChange(row.id, note.trim(), user);
      else await approvePhoneChange(row.id, user);
      setRejecting(null);
      setApproving(null);
      toast.success(rejectingRequest ? 'Đã từ chối yêu cầu đổi số.' : 'Đã duyệt yêu cầu đổi số.');
      reload();
      onChanged?.();
    } catch (err) {
      setNoteError(err.details?.note || '');
      toast.error(err, 'Không xử lý được yêu cầu');
      reload();
    } finally {
      setBusy(false);
    }
  };
  const columns = [
    { key: 'childName', header: 'Trẻ' },
    { key: 'guardianName', header: 'Phụ huynh' },
    { key: 'phone', header: 'Số cũ → số mới', render: (r) => `${r.oldPhone} → ${r.newPhone}` },
    { key: 'reason', header: 'Lý do' },
    { key: 'requestedByName', header: 'Người gửi' },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (r) =>
        r.canDecide && (
          <div className="row gap-2">
            <Button size="sm" disabled={busy} onClick={() => setApproving(r)}>
              Duyệt
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                setRejecting(r);
                setNote('');
                setNoteError('');
              }}
            >
              Từ chối
            </Button>
          </div>
        ),
    },
  ];
  return (
    <section className="card">
      <h2 className="card__title">Yêu cầu đổi số điện thoại</h2>
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={{ title: 'Không có yêu cầu chờ duyệt' }}
      />
      {rejecting && (
        <Modal
          open
          title="Từ chối yêu cầu đổi số"
          onClose={() => !busy && setRejecting(null)}
          footer={
            <Button disabled={!note.trim()} loading={busy} onClick={() => decide(rejecting, true)}>
              Từ chối
            </Button>
          }
        >
          <TextAreaField
            label="Lý do từ chối"
            required
            maxLength={300}
            value={note}
            error={noteError}
            onChange={(e) => setNote(e.target.value)}
          />
        </Modal>
      )}
      {approving && (
        <ConfirmationModal
          open
          title="Duyệt đổi số điện thoại?"
          message={`${approving.guardianName}: ${approving.oldPhone} → ${approving.newPhone}.`}
          confirmLabel="Duyệt"
          onConfirm={() => decide(approving, false)}
          onClose={() => setApproving(null)}
        />
      )}
    </section>
  );
}
