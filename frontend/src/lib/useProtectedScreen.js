import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

export function useProtectedScreen() {
  const auth = useAuth();
  const waitingForHydration = auth.authChecked && auth.isAuthenticated && !auth.user;
  const isTemporaryAuthFailure = auth.authChecked && !auth.isLoadingAuth && auth.authError?.type === 'auth_temporary_unavailable';
  const isCheckingAccess = auth.isLoadingAuth || !auth.authChecked || waitingForHydration;
  const canAccess = auth.authChecked && auth.isAuthenticated && !!auth.user;

  useEffect(() => {
    if (waitingForHydration && !auth.isLoadingAuth) {
      void auth.checkUserAuth();
    }
  }, [auth, waitingForHydration]);

  return {
    ...auth,
    isCheckingAccess,
    isTemporaryAuthFailure,
    waitingForHydration,
    canAccess,
  };
}
