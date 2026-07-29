import {
  getQueryBudget,
  triggerSlowQueryAlert,
  resetAlertCooldowns,
  DEFAULT_READ_QUERY_BUDGET_MS,
  DEFAULT_WRITE_QUERY_BUDGET_MS,
} from '../queryBudgets';

describe('Query Performance Budgets and Slow Query Alerts', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetAlertCooldowns();
    process.env.SLOW_QUERY_ALERT_COOLDOWN_MS = '1000'; // 1s for testing
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getQueryBudget()', () => {
    it('returns custom budget for configured model and action', () => {
      expect(getQueryBudget('User', 'findUnique')).toBe(50);
      expect(getQueryBudget('SharePriceSnapshot', 'create')).toBe(150);
    });

    it('returns default read budget for unconfigured read actions', () => {
      expect(getQueryBudget('UnknownModel', 'findMany')).toBe(DEFAULT_READ_QUERY_BUDGET_MS);
      expect(getQueryBudget('UnknownModel', 'count')).toBe(DEFAULT_READ_QUERY_BUDGET_MS);
    });

    it('returns default write budget for unconfigured write actions', () => {
      expect(getQueryBudget('UnknownModel', 'create')).toBe(DEFAULT_WRITE_QUERY_BUDGET_MS);
      expect(getQueryBudget('UnknownModel', 'update')).toBe(DEFAULT_WRITE_QUERY_BUDGET_MS);
    });
  });

  describe('triggerSlowQueryAlert()', () => {
    it('sends Slack alert when budget is breached and Slack is configured', async () => {
      process.env.ALERT_TYPE = 'slack';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';

      const calls: any[] = [];
      global.fetch = jest.fn().mockImplementation(async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200 } as any;
      });

      await triggerSlowQueryAlert('User', 'findUnique', 120, 50);

      expect(calls.length).toBe(1);
      expect(calls[0].url).toBe('https://hooks.slack.com/services/test');
      expect(calls[0].body.text).toContain('User.findUnique');
    });

    it('respects cooldown and suppresses duplicate alerts within cooldown window', async () => {
      process.env.ALERT_TYPE = 'slack';
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test';

      const calls: any[] = [];
      global.fetch = jest.fn().mockImplementation(async (url, opts) => {
        calls.push({ url, body: JSON.parse(opts.body) });
        return { ok: true, status: 200 } as any;
      });

      // First alert
      await triggerSlowQueryAlert('User', 'findUnique', 120, 50);
      expect(calls.length).toBe(1);

      // Second alert immediately (should be suppressed by cooldown)
      await triggerSlowQueryAlert('User', 'findUnique', 130, 50);
      expect(calls.length).toBe(1);
    });
  });
});
