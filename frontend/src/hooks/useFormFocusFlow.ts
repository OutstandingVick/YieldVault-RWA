import { useCallback, useEffect, useRef } from "react";

type FocusableElement = HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement;

export interface FormFocusField {
  id: string;
  hasError?: boolean;
}

interface UseFormFocusFlowOptions {
  /** Ordered list of focusable field ids within the form. */
  fields: FormFocusField[];
  /** Re-run initial focus when this value changes (e.g. tab or wizard step). */
  focusKey?: string;
  /** When true, move focus to the first field on focusKey change. */
  autoFocusOnKeyChange?: boolean;
}

/**
 * Keyboard-first focus helpers for multi-step forms.
 * Ensures predictable tab order and validation-driven focus jumps.
 */
export function useFormFocusFlow({
  fields,
  focusKey,
  autoFocusOnKeyChange = true,
}: UseFormFocusFlowOptions) {
  const containerRef = useRef<HTMLDivElement>(null);

  const resolveElement = useCallback((id: string): FocusableElement | null => {
    const root = containerRef.current ?? document;
    return root.querySelector<FocusableElement>(`#${CSS.escape(id)}`);
  }, []);

  const focusField = useCallback(
    (id: string) => {
      const element = resolveElement(id);
      element?.focus();
      return Boolean(element);
    },
    [resolveElement],
  );

  const focusFirstError = useCallback(() => {
    const errored = fields.find((field) => field.hasError);
    if (errored) {
      return focusField(errored.id);
    }
    return false;
  }, [fields, focusField]);

  const focusFirstField = useCallback(() => {
    const first = fields[0];
    return first ? focusField(first.id) : false;
  }, [fields, focusField]);

  useEffect(() => {
    if (!autoFocusOnKeyChange || !focusKey) return;
    const timer = window.setTimeout(() => {
      focusFirstField();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoFocusOnKeyChange, focusKey, focusFirstField]);

  const handleFormKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;

      const target = event.target as HTMLElement;
      if (target.tagName === "TEXTAREA") return;

      const ordered = fields
        .map((field) => resolveElement(field.id))
        .filter((element): element is FocusableElement => element !== null);

      const currentIndex = ordered.findIndex((element) => element === target);
      if (currentIndex === -1 || currentIndex >= ordered.length - 1) return;

      event.preventDefault();
      ordered[currentIndex + 1]?.focus();
    },
    [fields, resolveElement],
  );

  return {
    containerRef,
    focusField,
    focusFirstError,
    focusFirstField,
    handleFormKeyDown,
  };
}
