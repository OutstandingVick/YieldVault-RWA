/**
 * Retry budget service for external RPC dependencies.
 * Prevents runaway retries under upstream failure by tracking success/failure ratio.
 */

import { logger } from './middleware/structuredLogging';

interface RetryBudgetConfig {
  /** Maximum number of retries allowed per window */
  maxRetries: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Minimum success rate required (0.0 to 1.0) */
  minSuccessRate: number;
  /** Number of consecutive failures before circuit opens */
  failureThreshold: number;
}

interface RetryAttempt {
  timestamp: number;
  success: boolean;
}

const DEFAULT_CONFIG: RetryBudgetConfig = {
  maxRetries: parseInt(process.env.RETRY_BUDGET_MAX_RETRIES || '10', 10),
  windowMs: parseInt(process.env.RETRY_BUDGET_WINDOW_MS || '60000', 10),
  minSuccessRate: parseFloat(process.env.RETRY_BUDGET_MIN_SUCCESS_RATE || '0.5'),
  failureThreshold: parseInt(process.env.RETRY_BUDGET_FAILURE_THRESHOLD || '5', 10),
};

class RetryBudgetService {
  private attempts: RetryAttempt[] = [];
  private consecutiveFailures = 0;
  private config: RetryBudgetConfig;

  constructor(config: Partial<RetryBudgetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a retry is allowed based on current budget.
   * Returns true if retry is allowed, false if budget is exhausted.
   */
  canRetry(): boolean {
    this.pruneOldAttempts();

    // Check retry count within window
    const retryCount = this.attempts.filter((a) => !a.success).length;
    if (retryCount >= this.config.maxRetries) {
      logger.log('warn', 'Retry budget exhausted', {
        retryCount,
        maxRetries: this.config.maxRetries,
        windowMs: this.config.windowMs,
      });
      return false;
    }

    // Check consecutive failures
    if (this.consecutiveFailures >= this.config.failureThreshold) {
      logger.log('warn', 'Retry budget failure threshold exceeded', {
        consecutiveFailures: this.consecutiveFailures,
        failureThreshold: this.config.failureThreshold,
      });
      return false;
    }

    // Check success rate
    const totalAttempts = this.attempts.length;
    if (totalAttempts > 0) {
      const successCount = this.attempts.filter((a) => a.success).length;
      const successRate = successCount / totalAttempts;
      if (successRate < this.config.minSuccessRate) {
        logger.log('warn', 'Retry budget success rate too low', {
          successRate: Number(successRate.toFixed(2)),
          minSuccessRate: this.config.minSuccessRate,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Record a retry attempt result.
   */
  recordAttempt(success: boolean): void {
    const attempt: RetryAttempt = {
      timestamp: Date.now(),
      success,
    };
    this.attempts.push(attempt);

    if (success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    this.pruneOldAttempts();
  }

  /**
   * Get current retry budget stats.
   */
  getStats(): {
    remainingRetries: number;
    consecutiveFailures: number;
    successRate: number;
    totalAttempts: number;
  } {
    this.pruneOldAttempts();
    const totalAttempts = this.attempts.length;
    const successCount = this.attempts.filter((a) => a.success).length;
    const retryCount = this.attempts.filter((a) => !a.success).length;

    return {
      remainingRetries: Math.max(0, this.config.maxRetries - retryCount),
      consecutiveFailures: this.consecutiveFailures,
      successRate: totalAttempts > 0 ? successCount / totalAttempts : 1.0,
      totalAttempts,
    };
  }

  /**
   * Reset the retry budget (for testing or manual intervention).
   */
  reset(): void {
    this.attempts = [];
    this.consecutiveFailures = 0;
  }

  private pruneOldAttempts(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.attempts = this.attempts.filter((a) => a.timestamp > cutoff);
  }
}

// Singleton instance for Soroban RPC retries
export const sorobanRetryBudget = new RetryBudgetService();

// Export for testing and custom instances
export { RetryBudgetService, RetryBudgetConfig };
