import { useState, useCallback, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Allow multiple panels open simultaneously (default: false for single mode) */
  allowMultiple?: boolean;
  /** Initially expanded panel IDs */
  defaultExpanded?: string[];
  className?: string;
}

/**
 * Accessible accordion/disclosure component.
 *
 * - Keyboard: Enter/Space toggles, Arrow keys move focus.
 * - ARIA: role="region", aria-expanded, aria-controls, aria-labelledby.
 * - Supports single and multiple expanded panels.
 */
export function Accordion({
  items,
  allowMultiple = false,
  defaultExpanded = [],
  className,
}: AccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(defaultExpanded)
  );

  const toggle = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          if (!allowMultiple) next.clear();
          next.add(id);
        }
        return next;
      });
    },
    [allowMultiple]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const headers = Array.from(
        (e.currentTarget.parentElement?.querySelectorAll(
          "[data-accordion-header]"
        ) ?? []) as NodeListOf<HTMLButtonElement>
      );

      let targetIndex = index;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          targetIndex = (index + 1) % headers.length;
          break;
        case "ArrowUp":
          e.preventDefault();
          targetIndex = (index - 1 + headers.length) % headers.length;
          break;
        case "Home":
          e.preventDefault();
          targetIndex = 0;
          break;
        case "End":
          e.preventDefault();
          targetIndex = headers.length - 1;
          break;
        default:
          return;
      }

      headers[targetIndex]?.focus();
    },
    []
  );

  return (
    <div
      className={className}
      role="region"
      aria-label="Accordion"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {items.map((item, index) => {
        const isExpanded = expandedIds.has(item.id);
        const headerId = `accordion-header-${item.id}`;
        const panelId = `accordion-panel-${item.id}`;

        return (
          <div
            key={item.id}
            style={{
              border: "1px solid var(--border-glass)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-surface)",
              overflow: "hidden",
              transition: "border-color 0.2s ease",
            }}
          >
            {/* Header button – minimum 44px touch target */}
            <button
              id={headerId}
              data-accordion-header
              type="button"
              aria-expanded={isExpanded}
              aria-controls={panelId}
              onClick={() => toggle(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                minHeight: "48px",
                padding: "14px 20px",
                background: "transparent",
                color: "var(--text-primary)",
                fontSize: "var(--text-base)",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
                border: "none",
                gap: "12px",
                transition: "background 0.2s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--bg-surface-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span style={{ textAlign: "left", flex: 1 }}>{item.title}</span>
              <ChevronDown
                size={20}
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  transition: "transform 0.25s ease",
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  color: "var(--text-secondary)",
                }}
              />
            </button>

            {/* Panel */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isExpanded}
              style={{
                overflow: "hidden",
                transition: "max-height 0.25s ease",
                maxHeight: isExpanded ? "1000px" : "0",
              }}
            >
              <div
                style={{
                  padding: "0 20px 16px",
                  color: "var(--text-secondary)",
                  fontSize: "var(--text-sm)",
                  lineHeight: 1.6,
                }}
              >
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Accordion;