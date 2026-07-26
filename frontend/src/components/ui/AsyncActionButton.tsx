import React from "react";
import { Button, type ButtonStatus } from "./Button";
import {
  useAsyncActionButton,
  type UseAsyncActionButtonOptions,
} from "../../hooks/useAsyncActionButton";

type AsyncActionButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "status" | "children" | "isLoading"
> &
  UseAsyncActionButtonOptions & {
    className?: string;
    variant?: React.ComponentProps<typeof Button>["variant"];
    size?: React.ComponentProps<typeof Button>["size"];
    type?: React.ButtonHTMLAttributes<HTMLButtonElement>["type"];
    style?: React.CSSProperties;
    id?: string;
    onClick?: React.ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    disabled?: boolean;
  };

/**
 * Wallet/async action button with standardized pending, success, and error states.
 */
export const AsyncActionButton: React.FC<AsyncActionButtonProps> = ({
  labels,
  isPending,
  isSuccess,
  isError,
  successResetMs,
  errorResetMs,
  disabled,
  ...buttonProps
}) => {
  const { status, label, isDisabled } = useAsyncActionButton({
    labels,
    isPending,
    isSuccess,
    isError,
    successResetMs,
    errorResetMs,
  });

  const resolvedStatus: ButtonStatus = status;

  return (
    <Button
      {...buttonProps}
      status={resolvedStatus}
      disabled={disabled || isDisabled}
      loadingLabel={labels.pending}
      successLabel={labels.success}
      errorLabel={labels.error}
    >
      {label}
    </Button>
  );
};
