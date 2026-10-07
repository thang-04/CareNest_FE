import { useMemo } from 'react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { createEmptyTransferForm } from '@/models/facility-transfer/FacilityTransfer';
import { TransferWizard } from '@/components/facility-transfer/wizard/TransferWizard';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';

/** PHT-02..05: create a transfer with the 4-step wizard. */
export default function CreateTransferPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const initialForm = useMemo(() => createEmptyTransferForm(user), [user]);

  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs('Tạo phiếu luân chuyển')} />
      <h1 className="page__title">Tạo phiếu luân chuyển tài sản</h1>
      {md.loading ? (
        <LoadingState />
      ) : md.error ? (
        <ErrorState error={md.error} onRetry={md.reload} />
      ) : (
        <TransferWizard mode="create" initialForm={initialForm} md={md} />
      )}
    </div>
  );
}
