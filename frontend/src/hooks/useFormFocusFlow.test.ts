import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFormFocusFlow } from "./useFormFocusFlow";

describe("useFormFocusFlow", () => {
  it("focuses the first errored field", () => {
    document.body.innerHTML = `
      <div id="container">
        <input id="field-a" />
        <input id="field-b" />
      </div>
    `;

    const { result } = renderHook(() =>
      useFormFocusFlow({
        fields: [
          { id: "field-a", hasError: false },
          { id: "field-b", hasError: true },
        ],
        autoFocusOnKeyChange: false,
      }),
    );

    act(() => {
      result.current.containerRef.current = document.getElementById(
        "container",
      ) as HTMLDivElement | null;
      result.current.focusFirstError();
    });

    expect(document.activeElement?.id).toBe("field-b");
  });
});
