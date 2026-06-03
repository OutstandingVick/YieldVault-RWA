import { Activity, BarChart3, Landmark, PieChart } from 'lucide-react';
import { useTranslation } from '../i18n';

function AnalyticsPage() {
  const { t } = useTranslation();

  const metricCards = [
    {
      icon: Landmark,
      label: t('analytics.metrics.tvl.label'),
      value: '$12,450,800',
      detail: t('analytics.metrics.tvl.detail'),
    },
    {
      icon: Activity,
      label: t('analytics.metrics.apy.label'),
      value: '8.45%',
      detail: t('analytics.metrics.apy.detail'),
    },
    {
      icon: PieChart,
      label: t('analytics.metrics.exchangeRate.label'),
      value: '1 yvUSDC = 1.084 USDC',
      detail: t('analytics.metrics.exchangeRate.detail'),
    },
    {
      icon: BarChart3,
      label: t('analytics.metrics.networkFee.label'),
      value: '~0.00001 XLM',
      detail: t('analytics.metrics.networkFee.detail'),
    },
  ];

  return (
    <section className="flex flex-col gap-lg">
      <header className="glass-panel analytics-header">
        <span className="tag cyan" style={{ marginBottom: '16px' }}>
          {t('analytics.tag')}
        </span>
        <h2 style={{ fontSize: '2.4rem', marginBottom: '12px' }}>{t('analytics.title')}</h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            maxWidth: '720px',
          }}
        >
          {t('analytics.description')}
        </p>
      </header>

      <div className="analytics-metrics-grid">
        {metricCards.map(({ icon: Icon, label, value, detail }) => (
          <article key={label} className="glass-panel" style={{ padding: '24px' }}>
            <div
              className="flex items-center gap-sm"
              style={{ color: 'var(--accent-cyan)', marginBottom: '18px' }}
            >
              <Icon size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{label}</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.8rem',
                fontWeight: 700,
                marginBottom: '10px',
              }}
            >
              {value}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{detail}</p>
          </article>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: '28px' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>BENJI Strategy</h3>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '760px' }}>
          Capital is routed into tokenized sovereign debt exposure with daily reinvestment, giving
          depositors a stable yield profile and a steadily appreciating vault share price.
        </p>
      </div>
    </section>
  );
}

export default AnalyticsPage;
