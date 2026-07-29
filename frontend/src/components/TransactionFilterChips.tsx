import React from "react";
import { useTranslation } from "../i18n";
import type {
  ActiveFilterDescriptor,
  ActiveFilterKind,
} from "../lib/transactionQuery";

const KIND_LABEL_KEY: Record<ActiveFilterKind, string> = {
  search: "txFilter.search",
  type: "txFilter.types",
  status: "txFilter.statuses",
  asset: "txFilter.asset",
  dateFrom: "txFilter.fromDate",
  dateTo: "txFilter.toDate",
  amountMin: "txFilter.minAmount",
  amountMax: "txFilter.maxAmount",
};

export interface TransactionFilterChipsProps {
  chips: readonly ActiveFilterDescriptor[];
  onRemove: (chip: ActiveFilterDescriptor) => void;
}

/**
 * Summary of every applied filter, each removable on its own.
 *
 * The filter panel can be collapsed, and several filters are set from the URL
 * rather than by the person reading the table. Without a summary the only
 * evidence that rows are being hidden is a row count nobody has a reference
 * for. These chips state what is applied and let one constraint be lifted
 * without resetting the rest.
 */
export const TransactionFilterChips: React.FC<TransactionFilterChipsProps> = ({
  chips,
  onRemove,
}) => {
  const { t } = useTranslation();

  if (chips.length === 0) return null;

  const chipValue = (chip: ActiveFilterDescriptor): string => {
    if (chip.kind === "type") return t(`txFilter.type.${chip.value}`);
    if (chip.kind === "status") return t(`txFilter.status.${chip.value}`);
    return chip.value;
  };

  return (
    <div
      className="tx-filter-chips"
      role="group"
      aria-label={t("txFilter.activeFiltersAria")}
    >
      <span className="tx-filter-chips-label text-body-sm">
        {t("txFilter.activeFiltersLabel")}
      </span>

      <ul className="tx-filter-chip-list">
        {chips.map((chip) => {
          const label = `${t(KIND_LABEL_KEY[chip.kind])}: ${chipValue(chip)}`;

          return (
            <li key={chip.id} className="tx-filter-chip">
              <span className="tx-filter-chip-text">{label}</span>
              <button
                type="button"
                className="tx-filter-chip-remove"
                // The filter name leads, so the label reads as "what this
                // removes" and stays distinct from the panel's own controls.
                aria-label={`${label}, ${t("txFilter.removeFilterAria")}`}
                onClick={() => onRemove(chip)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TransactionFilterChips;
