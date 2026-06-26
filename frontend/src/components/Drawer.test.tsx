import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Drawer } from "./Drawer";

describe("Drawer", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderDrawer(isOpen = true) {
    return render(
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Drawer Title"
        description="Drawer description"
      >
        <button type="button">Inside button</button>
      </Drawer>,
    );
  }

  it("renders nothing when closed", () => {
    renderDrawer(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog when open", () => {
    renderDrawer(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Drawer Title")).toBeInTheDocument();
    expect(screen.getByText("Drawer description")).toBeInTheDocument();
  });

  it("closes on Escape key press", async () => {
    renderDrawer(true);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("closes on backdrop click", async () => {
    renderDrawer(true);

    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("does not close when clicking inside the panel", () => {
    renderDrawer(true);

    fireEvent.click(screen.getByRole("button", { name: "Inside button" }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when close button is clicked", () => {
    renderDrawer(true);

    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has aria-modal=true on the dialog", () => {
    renderDrawer(true);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("traps focus with Tab key", async () => {
    renderDrawer(true);

    const dialog = screen.getByRole("dialog");
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const lastElement = focusableElements[focusableElements.length - 1];
    lastElement.focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(focusableElements[0]);
  });
});
