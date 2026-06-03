import React from "react";
import { Wallet, ShieldCheck, DollarSign, ChevronRight } from "./icons";
import { useTranslation } from "../i18n";
import "./FirstTimePortfolioPanel.css";

interface Step {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  completed: boolean;
}

interface FirstTimePortfolioPanelProps {
  walletConnected: boolean;
  onConnectWallet: () => void;
  onReviewVault: () => void;
  onDeposit: () => void;
}

const FirstTimePortfolioPanel: React.FC<FirstTimePortfolioPanelProps> = ({
  walletConnected,
  onConnectWallet,
  onReviewVault,
  onDeposit,
}) => {
  const { t } = useTranslation();

  const steps: Step[] = [
    {
      number: 1,
      icon: <Wallet size={24} />,
      title: t("firstDeposit.step1.title"),
      description: t("firstDeposit.step1.description"),
      actionLabel: walletConnected ? t("firstDeposit.step1.connected") : t("firstDeposit.step1.action"),
      onAction: onConnectWallet,
      completed: walletConnected,
    },
    {
      number: 2,
      icon: <ShieldCheck size={24} />,
      title: t("firstDeposit.step2.title"),
      description: t("firstDeposit.step2.description"),
      actionLabel: t("firstDeposit.step2.action"),
      onAction: onReviewVault,
      completed: false,
    },
    {
      number: 3,
      icon: <DollarSign size={24} />,
      title: t("firstDeposit.step3.title"),
      description: t("firstDeposit.step3.description"),
      actionLabel: t("firstDeposit.step3.action"),
      onAction: onDeposit,
      completed: false,
    },
  ];

  const activeStep = steps.findIndex((s) => !s.completed);

  return (
    <div className="ftp-panel" role="region" aria-label={t("firstDeposit.ariaLabel")}>
      <div className="ftp-header">
        <h2 className="ftp-title">{t("firstDeposit.title")}</h2>
        <p className="ftp-subtitle">{t("firstDeposit.subtitle")}</p>
      </div>

      <ol className="ftp-steps" aria-label={t("firstDeposit.stepsAria")}>
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isPast = step.completed;
          const isFuture = !isPast && !isActive;

          return (
            <li
              key={step.number}
              className={`ftp-step ${isPast ? "ftp-step--done" : ""} ${isActive ? "ftp-step--active" : ""} ${isFuture ? "ftp-step--future" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="ftp-step-indicator" aria-hidden="true">
                <div className="ftp-step-number">
                  {isPast ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                {index < steps.length - 1 && <div className="ftp-step-connector" />}
              </div>

              <div className="ftp-step-body">
                <div className="ftp-step-icon" aria-hidden="true">{step.icon}</div>
                <div className="ftp-step-content">
                  <h3 className="ftp-step-title">{step.title}</h3>
                  <p className="ftp-step-description">{step.description}</p>
                </div>
                <button
                  type="button"
                  className={`btn ftp-step-btn ${isPast ? "btn-outline" : isActive ? "btn-primary" : "btn-outline"}`}
                  onClick={step.onAction}
                  disabled={isPast || isFuture}
                  aria-label={t("firstDeposit.stepAria")
                    .replace("{{action}}", step.actionLabel)
                    .replace("{{number}}", String(step.number))}
                >
                  {step.actionLabel}
                  {isActive && <ChevronRight size={16} aria-hidden="true" />}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default FirstTimePortfolioPanel;
