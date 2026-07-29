import React from "react";
import { Wallet, Layers, TrendingUp } from "./icons";
import { useTranslation } from "../i18n";
import "./OnboardingPanel.css";

interface OnboardingStep {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  completed: boolean;
}

interface OnboardingPanelProps {
  walletConnected: boolean;
  onConnectWallet: () => void;
  onReviewVault: () => void;
  onDeposit: () => void;
}

const OnboardingPanel: React.FC<OnboardingPanelProps> = ({
  walletConnected,
  onConnectWallet,
  onReviewVault,
  onDeposit,
}) => {
  const { t } = useTranslation();

  const steps: OnboardingStep[] = [
    {
      step: 1,
      icon: <Wallet size={24} />,
      title: t("onboarding.step1.title"),
      description: t("onboarding.step1.description"),
      actionLabel: walletConnected ? t("onboarding.step1.connected") : t("onboarding.step1.action"),
      onAction: onConnectWallet,
      completed: walletConnected,
    },
    {
      step: 2,
      icon: <Layers size={24} />,
      title: t("onboarding.step2.title"),
      description: t("onboarding.step2.description"),
      actionLabel: t("onboarding.step2.action"),
      onAction: onReviewVault,
      completed: false,
    },
    {
      step: 3,
      icon: <TrendingUp size={24} />,
      title: t("onboarding.step3.title"),
      description: t("onboarding.step3.description"),
      actionLabel: t("onboarding.step3.action"),
      onAction: onDeposit,
      completed: false,
    },
  ];

  const activeStep = walletConnected ? 1 : 0;

  return (
    <div className="onboarding-panel" role="region" aria-label={t("onboarding.ariaLabel")}>
      <div className="onboarding-panel-header">
        <h2 className="onboarding-panel-title">{t("onboarding.title")}</h2>
        <p className="onboarding-panel-subtitle">
          {t("onboarding.subtitle")}
        </p>
      </div>

      <ol className="onboarding-steps" aria-label={t("onboarding.stepsAria")}>
        {steps.map((s, idx) => {
          const isActive = idx === activeStep;
          const isPast = s.completed;
          const isFuture = idx > activeStep && !s.completed;

          return (
            <li
              key={s.step}
              className={[
                "onboarding-step",
                isPast ? "onboarding-step--completed" : "",
                isActive ? "onboarding-step--active" : "",
                isFuture ? "onboarding-step--future" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="onboarding-step-indicator" aria-hidden="true">
                {isPast ? (
                  <span className="onboarding-step-check">✓</span>
                ) : (
                  <span className="onboarding-step-number">{s.step}</span>
                )}
              </div>

              <div className="onboarding-step-icon" aria-hidden="true">
                {s.icon}
              </div>

              <div className="onboarding-step-content">
                <h3 className="onboarding-step-title">{s.title}</h3>
                <p className="onboarding-step-description">{s.description}</p>
              </div>

              <button
                type="button"
                className={`btn ${isActive ? "btn-primary" : "btn-outline"} onboarding-step-action`}
                onClick={s.onAction}
                disabled={isPast || isFuture}
                aria-label={s.actionLabel}
              >
                {s.actionLabel}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default OnboardingPanel;
