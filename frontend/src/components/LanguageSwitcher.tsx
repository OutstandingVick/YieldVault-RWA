import { useTranslation, type LocaleCode } from "../i18n";

const LOCALES: { code: LocaleCode; flag: string }[] = [
  { code: "en", flag: "🇺🇸" },
  { code: "es", flag: "🇪🇸" },
];

export default function LanguageSwitcher() {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          fontSize: "0.82rem",
          fontWeight: 600,
          color: "var(--text-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {t("langSwitch.label")}
      </span>
      <div style={{ display: "flex", gap: "4px" }}>
        {LOCALES.map(({ code, flag }) => {
          const isActive = locale === code;
          return (
            <button
              key={code}
              onClick={() => setLocale(code)}
              aria-pressed={isActive}
              aria-label={t(`langSwitch.${code}`)}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: isActive
                  ? "1.5px solid var(--accent-cyan)"
                  : "1.5px solid var(--border-glass)",
                background: isActive
                  ? "linear-gradient(135deg, rgba(0,240,255,0.12), rgba(112,0,255,0.08))"
                  : "rgba(255,255,255,0.03)",
                color: isActive ? "var(--accent-cyan)" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: isActive ? 600 : 400,
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span aria-hidden="true">{flag}</span>
              {t(`langSwitch.${code}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
