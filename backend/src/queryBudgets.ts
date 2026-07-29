import { logger } from './middleware/structuredLogging';

// Default budget thresholds in milliseconds
export const DEFAULT_READ_QUERY_BUDGET_MS = 100;
export const DEFAULT_WRITE_QUERY_BUDGET_MS = 200;

// Specific query budgets by model and action
// Format: "Model.action"
export const QUERY_BUDGETS: Record<string, number> = {
  'User.findUnique': 50,
  'VaultState.findUnique': 50,
  'SharePriceSnapshot.create': 150,
  'Transaction.findMany': 150,
  'Referral.findUnique': 50,
  'WebhookEndpoint.findMany': 100,
  'WebhookDelivery.findMany': 150,
};

// Cooldown tracker to prevent alert spamming (default: 15 minutes)
const getAlertCooldownMs = (): number =>
  parseInt(process.env.SLOW_QUERY_ALERT_COOLDOWN_MS || '900000', 10);

const lastAlertTimes = new Map<string, number>();

/**
 * Resolves the performance budget for a Prisma query in milliseconds.
 */
export function getQueryBudget(model: string, action: string): number {
  const key = `${model}.${action}`;
  if (QUERY_BUDGETS[key] !== undefined) {
    return QUERY_BUDGETS[key];
  }

  // Classify read vs write actions
  const isRead = [
    'findUnique',
    'findFirst',
    'findMany',
    'count',
    'queryRaw',
    'aggregate',
    'groupBy',
  ].includes(action);

  return isRead ? DEFAULT_READ_QUERY_BUDGET_MS : DEFAULT_WRITE_QUERY_BUDGET_MS;
}

/**
 * Triggers an alert when a query exceeds its performance budget.
 */
export async function triggerSlowQueryAlert(
  model: string,
  action: string,
  durationMs: number,
  budgetMs: number,
): Promise<void> {
  const key = `${model}.${action}`;
  const now = Date.now();
  const lastAlert = lastAlertTimes.get(key) || 0;
  const cooldownMs = getAlertCooldownMs();

  if (now - lastAlert < cooldownMs) {
    // Cooldown active, skip alerting
    return;
  }

  lastAlertTimes.set(key, now);

  logger.log('error', `Slow query alert: ${key} exceeded budget`, {
    model,
    action,
    durationMs: Math.round(durationMs * 100) / 100,
    budgetMs,
  });

  // Send alert to external channels if configured
  const alertType = process.env.ALERT_TYPE || 'slack';
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const pagerDutyKey = process.env.PAGERDUTY_INTEGRATION_KEY;

  const alertPromises: Promise<unknown>[] = [];

  if ((alertType === 'slack' || alertType === 'both') && slackUrl) {
    alertPromises.push(
      fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Slow Database Query Alert: ${key}`,
          attachments: [
            {
              color: 'danger',
              fields: [
                { title: 'Query', value: key, short: true },
                { title: 'Duration', value: `${durationMs.toFixed(2)}ms`, short: true },
                { title: 'Budget', value: `${budgetMs}ms`, short: true },
                { title: 'Time', value: new Date().toISOString(), short: true },
              ],
            },
          ],
        }),
      }).catch((err) =>
        logger.log('error', 'Failed to send slow query Slack alert', {
          error: err instanceof Error ? err.message : String(err),
        }),
      ),
    );
  }

  if ((alertType === 'pagerduty' || alertType === 'both') && pagerDutyKey) {
    alertPromises.push(
      fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: pagerDutyKey,
          event_action: 'trigger',
          payload: {
            summary: `Slow Query: ${key} took ${durationMs.toFixed(2)}ms (budget: ${budgetMs}ms)`,
            source: 'yieldvault-backend',
            severity: 'warning',
            component: 'database',
            group: 'performance',
            class: 'slow-query',
            custom_details: { model, action, durationMs, budgetMs },
          },
        }),
      }).catch((err) =>
        logger.log('error', 'Failed to send slow query PagerDuty alert', {
          error: err instanceof Error ? err.message : String(err),
        }),
      ),
    );
  }

  await Promise.all(alertPromises);
}

export function resetAlertCooldowns(): void {
  lastAlertTimes.clear();
}
