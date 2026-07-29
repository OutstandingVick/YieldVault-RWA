import { describe, expect, it, beforeEach } from "vitest";
import {
  clearVaultFormDraft,
  hasMeaningfulDraft,
  loadVaultFormDraft,
  saveVaultFormDraft,
} from "./formDraftStorage";

describe("formDraftStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("saves and loads a vault form draft", () => {
    saveVaultFormDraft({
      tab: "deposit",
      step: "review",
      amount: "125.5",
    });

    expect(loadVaultFormDraft()).toMatchObject({
      tab: "deposit",
      step: "review",
      amount: "125.5",
    });
  });

  it("detects meaningful drafts", () => {
    expect(hasMeaningfulDraft(null)).toBe(false);
    expect(
      hasMeaningfulDraft({
        tab: "deposit",
        step: "amount",
        amount: "",
        savedAt: Date.now(),
      }),
    ).toBe(false);
    expect(
      hasMeaningfulDraft({
        tab: "withdraw",
        step: "amount",
        amount: "10",
        savedAt: Date.now(),
      }),
    ).toBe(true);
  });

  it("clears stored drafts", () => {
    saveVaultFormDraft({ tab: "deposit", step: "amount", amount: "1" });
    clearVaultFormDraft();
    expect(loadVaultFormDraft()).toBeNull();
  });
});
