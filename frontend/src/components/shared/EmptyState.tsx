import React from "react";
import type { ReactNode } from "react";
import {
  EmptyState as UiEmptyState,
  type EmptyStateProps as UiEmptyStateProps,
} from "../ui/EmptyState";

interface EmptyStateProps
  extends Omit<UiEmptyStateProps, "actionLabel" | "onAction"> {
  ctaLabel: string;
  onAction: () => void;
  icon?: ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  ctaLabel,
  onAction,
  icon,
  kind = "no-data",
  ...rest
}) => (
  <UiEmptyState
    kind={kind}
    actionLabel={ctaLabel}
    onAction={onAction}
    icon={icon}
    {...rest}
  />
);

export default EmptyState;
