import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { createEmptyTransferForm } from '@/models/facility-transfer/FacilityTransfer';
import { createTransferItem } from '@/models/facility-transfer/FacilityTransferItem';
import { TRANSFER_TYPES, TRANSFER_TYPE_LOCATION_TYPES } from '@/models/facility-transfer/transferConstants';
import { getAvailableAssets } from '@/services/facility-transfer/transferService';
import { TransferWizard } from '@/components/facility-transfer/wizard/TransferWizard';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';

/**
 * ?from=<locationId>: "move every asset out of this room" (Room List). The sending room and all its free quantities are
 * pre-selected; the VP only picks the receiving room. Ignored when the room is not of this VP's campus or cannot be a
 * transfer side (storerooms – allocation flow BF-08).
 */
const prefillFromRoom = async (form, room) => {
  const type = TRANSFER_TYPE_LOCATION_TYPES[TRANSFER_TYPES.INTRA_CAMPUS_ROOM].includes(room.type)
    ? TRANSFER_TYPES.INTRA_CAMPUS_ROOM
    : TRANSFER_TYPE_LOCATION_TYPES[TRANSFER_TYPES.INTRA_CAMPUS_DEPARTMENT].includes(room.type)
      ? TRANSFER_TYPES.INTRA_CAMPUS_DEPARTMENT
      : null;
  if (!type || room.campusId !== form.fromCampusId) return form;
  const assets = await getAvailableAssets(room.id);
  return {
    ...form,
    type,
    fromLocationId: room.id,
    handoverUserId: room.managerUserId || null,
    reason: `Chuyển hết tài sản ra khỏi ${room.room ? `${room.room} · ` : ''}${room.name} để ngừng sử dụng phòng`,
    items: assets.filter((a) => a.availableQuantity > 0).map((a) => createTransferItem(a, a.availableQuantity)),
  };
};

/** PHT-02..05: create a transfer with the 4-step wizard. */
export default function CreateTransferPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [params] = useSearchParams();
  const fromId = params.get('from');
  const [initialForm, setInitialForm] = useState(null);
  const [prefillError, setPrefillError] = useState(null);

  useEffect(() => {
    if (md.loading) return;
    const empty = createEmptyTransferForm(user);
    const room = fromId && md.locationById(fromId);
    if (!room) {
      setInitialForm(empty);
      return;
    }
    prefillFromRoom(empty, room)
      .then(setInitialForm)
      .catch((err) => {
        setPrefillError(err);
        setInitialForm(empty);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [md.loading, fromId, user]);

  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs('Tạo phiếu luân chuyển')} />
      <h1 className="page__title">Tạo phiếu luân chuyển tài sản</h1>
      {md.error ? (
        <ErrorState error={md.error} onRetry={md.reload} />
      ) : md.loading || !initialForm ? (
        <LoadingState />
      ) : (
        <>
          {prefillError && <ErrorState error={prefillError} />}
          <TransferWizard mode="create" initialForm={initialForm} md={md} />
        </>
      )}
    </div>
  );
}
