import React from "react";

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
}

interface PrintFooterProps {
  appName?: string;
}

export const PrintHeader: React.FC<PrintHeaderProps> = ({
  title,
  subtitle,
}) => {
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="report-header print-only">
      <div>
        <h1 className="report-title">{title}</h1>
        {subtitle && <p style={{ color: "#64748b", marginTop: "4px" }}>{subtitle}</p>}
      </div>
      <div className="report-date">{today}</div>
    </header>
  );
};

export const PrintFooter: React.FC<PrintFooterProps> = ({
  appName = "YieldVault",
}) => {
  const year = new Date().getFullYear();

  return (
    <footer className="report-footer print-only">
      <div>{appName} Report</div>
      <div>
        Page <span className="print-page-number">1</span> of{" "}
        <span className="print-page-total">1</span>
      </div>
      <div>&copy; {year} {appName}</div>
    </footer>
  );
};