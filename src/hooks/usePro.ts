import { useCallback, useEffect, useState } from "react";
import {
  canBatchExport,
  canExportHq,
  canShareOwnClip,
  canUseTargetHz,
  getProState,
  hydrateProFromBackup,
  restoreProAccess,
  restorePurchases,
  startCheckout,
  subscribePro,
  type CheckoutOptions,
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

  useEffect(() => {
    void (async () => {
      const ok = await hydrateProFromBackup();
      if (ok) setState(getProState());
      if (isRevenueCatNative()) {
        try {
          const { syncProFromCustomerInfo, initRevenueCat } = await import(
            "../lib/revenueCat"
          );
          await initRevenueCat();
          await syncProFromCustomerInfo();
          setState(getProState());
        } catch {
          /* optional until RC keys + offerings are configured */
        }
      }
    })();
  }, []);

  const refresh = useCallback(() => setState(getProState()), []);

  const exportGate: ExportGate = canExportHq();

  const upgrade = useCallback(async (opts?: CheckoutOptions) => {
    setCheckoutBusy(true);
    setCheckoutError(null);
    try {
      await startCheckout(opts ?? { tier: "pro" });
      setCheckoutBusy(false);
      setState(getProState());
    } catch (e) {
      setCheckoutError(
        e instanceof Error ? e.message : "Could not start checkout.",
      );
      setCheckoutBusy(false);
    }
  }, []);

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

  const restoreAccess = useCallback(
    async (input?: { email?: string; sessionId?: string; code?: string }) => {
      setCheckoutBusy(true);
      setCheckoutError(null);
      try {
        const result = await restoreProAccess(input ?? {});
        setState(getProState());
        if (!result.ok) {
          setCheckoutError(result.error || "Could not restore access.");
          return false;
        }
        return true;
      } catch (e) {
        setCheckoutError(
          e instanceof Error ? e.message : "Could not restore access.",
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
    canBatchExport: canBatchExport(),
    canShareOwnClip: canShareOwnClip(),
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
