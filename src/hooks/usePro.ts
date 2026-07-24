import { useCallback, useEffect, useState } from "react";
import {
  canExportHq,
  canUseTargetHz,
  getProState,
  hydrateProFromBackup,
  restoreProAccess,
  restorePurchases,
  startCheckout,
  subscribePro,
  type ExportGate,
  type ProState,
} from "../lib/pro";
import { isRevenueCatNative } from "../lib/revenueCat";

export function usePro() {
  const [state, setState] = useState<ProState>(() => getProState());
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const nativeBilling = isRevenueCatNative();

  useEffect(() => subscribePro(() => setState(getProState())), []);

  // Recover Pro from IndexedDB backup if localStorage was cleared
  useEffect(() => {
    void (async () => {
      const ok = await hydrateProFromBackup();
      if (ok) setState(getProState());
      // Native: also sync App Store entitlement on launch
      if (isRevenueCatNative() && !getProState().isPro) {
        try {
          const { syncProFromCustomerInfo, initRevenueCat } = await import(
            "../lib/revenueCat"
          );
          await initRevenueCat();
          await syncProFromCustomerInfo();
          setState(getProState());
        } catch {
          /* optional */
        }
      }
    })();
  }, []);

  const refresh = useCallback(() => setState(getProState()), []);

  const exportGate: ExportGate = canExportHq();

  const upgrade = useCallback(async () => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      await startCheckout();
      setCheckoutBusy(false);
      setState(getProState());
    } catch (e) {
      setCheckoutError(
        e instanceof Error ? e.message : "Could not start checkout.",
      );
      setCheckoutBusy(false);
    }
  }, []);

  /** App Store / Play restore only */
  const restore = useCallback(async () => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      const ok = await restorePurchases();
      if (!ok) {
        setCheckoutError(
          "No App Store / Play purchase found. If you paid by card, use Restore with your Stripe email.",
        );
      }
      setState(getProState());
    } catch (e) {
      setCheckoutError(
        e instanceof Error ? e.message : "Could not restore purchases.",
      );
    } finally {
      setCheckoutBusy(false);
    }
  }, []);

  /**
   * Restore Pro: store (no args) or Stripe email / session id.
   * Returns true when Pro is active after the call.
   */
  const restoreAccess = useCallback(
    async (input?: { email?: string; sessionId?: string }) => {
      setCheckoutBusy(true);
      setCheckoutError(null);
      try {
        const result = await restoreProAccess(input ?? {});
        setState(getProState());
        if (!result.ok) {
          setCheckoutError(result.error || "Could not restore Pro.");
          return false;
        }
        return true;
      } catch (e) {
        setCheckoutError(
          e instanceof Error ? e.message : "Could not restore Pro.",
        );
        return false;
      } finally {
        setCheckoutBusy(false);
      }
    },
    [],
  );

  return {
    ...state,
    exportGate,
    canUseTargetHz,
    checkoutBusy,
    checkoutError,
    setCheckoutError,
    upgrade,
    restore,
    restoreAccess,
    nativeBilling,
    refresh,
  };
}
