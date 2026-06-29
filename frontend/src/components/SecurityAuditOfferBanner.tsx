import React from "react";
import { ShieldCheck, ExternalLink } from "./icons";
import { networkConfig } from "../config/network";
import { useTranslation } from "../i18n";

const AUDIT_CONTACT_EMAIL = "security@yieldvault.io";

const SecurityAuditOfferBanner: React.FC = () => {
  const { t } = useTranslation();

  if (!networkConfig.isTestnet) {
    return null;
  }

  const mailtoHref = `mailto:${AUDIT_CONTACT_EMAIL}?subject=${encodeURIComponent(
    t("securityOffer.emailSubject"),
  )}`;

  return (
    <aside
      className="glass-panel security-audit-offer"
      aria-labelledby="security-audit-offer-heading"
      style={{
        marginBottom: "32px",
        padding: "20px 24px",
        display: "flex",
        alignItems: "flex-start",
        gap: "16px",
        border: "1px solid rgba(34, 197, 94, 0.25)",
        background:
          "linear-gradient(135deg, rgba(34, 197, 94, 0.06), rgba(0, 240, 255, 0.04))",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "10px",
          borderRadius: "12px",
          background: "rgba(34, 197, 94, 0.12)",
          color: "rgb(34, 197, 94)",
        }}
        aria-hidden="true"
      >
        <ShieldCheck size={22} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          className="tag"
          style={{
            marginBottom: "8px",
            color: "rgb(34, 197, 94)",
            fontSize: "0.7rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {t("securityOffer.badge")}
        </p>
        <h2
          id="security-audit-offer-heading"
          style={{ marginBottom: "8px", fontSize: "1.1rem" }}
        >
          {t("securityOffer.title")}
        </h2>
        <p
          className="text-body-sm"
          style={{ color: "var(--text-secondary)", marginBottom: "14px" }}
        >
          {t("securityOffer.description")}
        </p>
        <div className="flex items-center gap-md" style={{ flexWrap: "wrap" }}>
          <a
            href={mailtoHref}
            className="btn btn-primary btn-sm"
            style={{ textDecoration: "none" }}
          >
            {t("securityOffer.cta")}
            <ExternalLink size={14} />
          </a>
          <span
            className="text-body-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("securityOffer.disclaimer")}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default SecurityAuditOfferBanner;
