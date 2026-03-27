import { useMemo } from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

interface BreadcrumbSegment {
  label: string;
  path: string;
  isCurrent: boolean;
}

/**
 * Maps route paths to human-readable labels.
 * Extend this map as new routes are added.
 */
const ROUTE_LABELS: Record<string, string> = {
  "": "Home",
  portfolio: "Portfolio",
  analytics: "Analytics",
  transactions: "Transactions",
  settings: "Settings",
};

/**
 * Derives breadcrumb segments from the current URL pathname.
 */
function deriveBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const parts = pathname.split("/").filter(Boolean);
  const segments: BreadcrumbSegment[] = [
    { label: "Home", path: "/", isCurrent: parts.length === 0 },
  ];

  let accumulated = "";
  parts.forEach((part, index) => {
    accumulated += `/${part}`;
    const isCurrent = index === parts.length - 1;
    segments.push({
      label: ROUTE_LABELS[part] ?? part.charAt(0).toUpperCase() + part.slice(1),
      path: accumulated,
      isCurrent,
    });
  });

  return segments;
}

interface BreadcrumbsProps {
  className?: string;
  /** Override auto-derived segments with custom ones */
  segments?: BreadcrumbSegment[];
}

/**
 * Accessible breadcrumb navigation.
 *
 * - Uses <nav aria-label="Breadcrumb"> for screen readers.
 * - Renders an ordered list (<ol>) for semantic correctness.
 * - Current page link is non-clickable with aria-current="page".
 * - Separators are aria-hidden to avoid screen-reader noise.
 */
export function Breadcrumbs({ className, segments }: BreadcrumbsProps) {
  const location = useLocation();

  const resolvedSegments = useMemo(
    () => segments ?? deriveBreadcrumbs(location.pathname),
    [segments, location.pathname]
  );

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol
        style={{
          display: "flex",
          alignItems: "center",
          listStyle: "none",
          margin: 0,
          padding: 0,
          gap: "6px",
          fontSize: "var(--text-sm)",
          color: "var(--text-secondary)",
          flexWrap: "wrap",
        }}
      >
        {resolvedSegments.map((segment, index) => {
          const isFirst = index === 0;
          const isLast = segment.isCurrent;

          return (
            <li
              key={segment.path}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {/* Separator */}
              {index > 0 && (
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  style={{ flexShrink: 0, color: "var(--text-tertiary)" }}
                />
              )}

              {/* Link or current page indicator */}
              {isLast ? (
                <span
                  aria-current="page"
                  style={{
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    cursor: "default",
                  }}
                >
                  {isFirst && <Home size={14} style={{ marginRight: 4 }} />}
                  {segment.label}
                </span>
              ) : (
                <Link
                  to={segment.path}
                  style={{
                    color: "var(--text-secondary)",
                    textDecoration: "none",
                    transition: "color 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    minHeight: "32px",
                    padding: "2px 4px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--accent-cyan)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--text-secondary)")
                  }
                >
                  {isFirst && <Home size={14} />}
                  {segment.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;