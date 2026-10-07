import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from './useAsync';
import { deleteSignature, getMySignatures, saveSignature, setDefaultSignature } from '@/services/signatureService';

/** Signatures saved on the current account. */
export function useSignatures() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getMySignatures(user), [user?.id], { enabled: !!user });

  const save = useCallback(
    async (imageUrl, isDefault = false) => {
      const sig = await saveSignature(user, { imageUrl, isDefault });
      await reload({ silent: true });
      return sig;
    },
    [user, reload],
  );

  const makeDefault = useCallback(
    async (id) => {
      await setDefaultSignature(user, id);
      await reload({ silent: true });
    },
    [user, reload],
  );

  const remove = useCallback(
    async (id) => {
      await deleteSignature(user, id);
      await reload({ silent: true });
    },
    [user, reload],
  );

  const signatures = data || [];
  return {
    signatures,
    defaultSignature: signatures.find((s) => s.isDefault) || signatures[0] || null,
    loading,
    error,
    save,
    makeDefault,
    remove,
  };
}
