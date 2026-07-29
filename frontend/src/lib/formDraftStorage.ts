import type { TransactionTab, TransactionStep } from "../hooks/useDashboardUrlState";

export const FORM_DRAFT_STORAGE_KEY = "yieldvault_vault_form_draft";

export interface VaultFormDraft {
  tab: TransactionTab;
  step: TransactionStep;
  amount: string;
  slippage?: string;
  savedAt: number;
}

export function saveVaultFormDraft(draft: Omit<VaultFormDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: VaultFormDraft = { ...draft, savedAt: Date.now() };
    sessionStorage.setItem(FORM_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage unavailable
  }
}

export function loadVaultFormDraft(): VaultFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FORM_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultFormDraft;
    if (!parsed?.tab || typeof parsed.amount !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearVaultFormDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FORM_DRAFT_STORAGE_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

export function hasMeaningfulDraft(draft: VaultFormDraft | null): boolean {
  if (!draft) return false;
  return draft.amount.trim().length > 0 || draft.step !== "amount";
}
