import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Copy } from "./icons";
import { useToast } from "../context/ToastContext";
import { copyTextToClipboard } from "../lib/clipboard";
import { useTranslation } from "../i18n";

interface CopyButtonProps {
  value: string;
  label: string;
  successTitle?: string;
  successDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
}

type CopyStatus = "idle" | "success" | "error";

const FEEDBACK_TIMEOUT = 2000;

function toSentenceCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label,
  successTitle,
  successDescription,
  errorTitle,
  errorDescription,
}) => {
  const toast = useToast();
  const { t } = useTranslation();
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showFeedback = (nextStatus: Exclude<CopyStatus, "idle">) => {
    setStatus(nextStatus);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
      timeoutRef.current = null;
    }, FEEDBACK_TIMEOUT);
  };

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(value);
      showFeedback("success");
      toast.success({
        title: successTitle ?? t("copyButton.defaultSuccessTitle").replace("{{label}}", toSentenceCase(label)),
        description: successDescription ?? t("copyButton.defaultSuccessDesc").replace("{{label}}", label),
      });
    } catch (error) {
      console.error("Clipboard copy failed:", error);
      showFeedback("error");
      toast.error({
        title: errorTitle ?? t("copyButton.defaultErrorTitle").replace("{{label}}", label),
        description: errorDescription ?? t("copyButton.defaultErrorDesc"),
      });
    }
  };

  const feedbackText =
    status === "success"
      ? t("copyButton.copied")
      : status === "error"
      ? t("copyButton.copyFailed")
      : "";

  return (
    <span className="copy-action">
      <button
        type="button"
        className="copy-button"
        onClick={handleCopy}
        aria-label={t("copyButton.copyAria").replace("{{label}}", label)}
        data-status={status}
      >
        {status === "success" ? (
          <Check size={14} aria-hidden="true" />
        ) : status === "error" ? (
          <AlertCircle size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
      </button>
      <span
        className={`copy-feedback ${status === "idle" ? "" : "is-visible"}`.trim()}
        data-status={status}
        aria-live="polite"
      >
        {feedbackText}
      </span>
    </span>
  );
};

export default CopyButton;
