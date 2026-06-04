import { useTranslation } from "../i18n";

function AppHero() {
  const { t } = useTranslation();
  return (
    <header style={{ textAlign: 'center', marginBottom: '48px' }}>
      <span className="tag cyan" style={{ marginBottom: '16px' }}>
        {t("hero.tag")}
      </span>
      <h1 style={{ fontSize: '3.5rem', marginBottom: '16px' }}>
        {t("hero.heading")} <br />
        <span className="text-gradient">{t("hero.headingAccent")}</span>
      </h1>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '1.2rem',
          maxWidth: '600px',
          margin: '0 auto',
        }}
      >
        {t("hero.description")}
      </p>
    </header>
  );
}

export default AppHero;
