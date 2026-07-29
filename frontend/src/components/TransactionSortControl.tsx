import React, { useId } from "react";
import { useTranslation } from "../i18n";
import {
  MAX_SORT_KEYS,
  SORTABLE_FIELDS,
  type SortDirection,
  type SortField,
  type SortKey,
} from "../lib/transactionQuery";
import { SORT_FIELD_LABEL_KEY } from "../lib/transactionSortLabels";

export interface TransactionSortControlProps {
  /** Active sort keys in priority order; empty means the default ordering. */
  sortKeys: readonly SortKey[];
  onAdd: (field: SortField) => void;
  onRemove: (field: SortField) => void;
  onDirectionChange: (field: SortField, direction: SortDirection) => void;
  /** Moves a key up (-1) or down (+1) the priority list. */
  onMove: (field: SortField, offset: number) => void;
  onClear: () => void;
}

/**
 * Editor for the table's multi-column sort.
 *
 * Shift-clicking column headers can build the same state, but only for someone
 * who already knows the gesture and can use a pointer. This panel makes the
 * full capability reachable: it names the active keys, shows their priority,
 * and exposes reorder / flip / remove as ordinary buttons. It is also the only
 * place the ordering is stated in words, which is what a screen reader user
 * gets instead of the arrow glyphs in the header row.
 */
export const TransactionSortControl: React.FC<TransactionSortControlProps> = ({
  sortKeys,
  onAdd,
  onRemove,
  onDirectionChange,
  onMove,
  onClear,
}) => {
  const { t } = useTranslation();
  const uid = useId();

  const usedFields = new Set(sortKeys.map((key) => key.field));
  const availableFields = SORTABLE_FIELDS.filter(
    (field) => !usedFields.has(field),
  );
  const atCapacity = sortKeys.length >= MAX_SORT_KEYS;
  const canAdd = availableFields.length > 0 && !atCapacity;

  const directionLabel = (direction: SortDirection) =>
    direction === "asc" ? t("txSort.ascending") : t("txSort.descending");

  return (
    <section className="tx-sort-control" aria-labelledby={`${uid}-heading`}>
      <div className="tx-sort-header">
        <h3 id={`${uid}-heading`} className="tx-sort-title">
          {t("txSort.title")}
        </h3>
        {sortKeys.length > 0 && (
          <button
            type="button"
            className="tx-sort-reset"
            onClick={onClear}
            aria-label={t("txSort.resetAria")}
          >
            {t("txSort.reset")}
          </button>
        )}
      </div>

      {sortKeys.length === 0 ? (
        <p className="tx-sort-empty text-body-sm">{t("txSort.defaultOrder")}</p>
      ) : (
        <ol className="tx-sort-list">
          {sortKeys.map((key, index) => {
            const fieldLabel = t(SORT_FIELD_LABEL_KEY[key.field]);
            const nextDirection: SortDirection =
              key.direction === "asc" ? "desc" : "asc";

            return (
              <li key={key.field} className="tx-sort-item">
                <span className="tx-sort-priority" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="tx-sort-field">{fieldLabel}</span>

                <button
                  type="button"
                  className="tx-sort-direction"
                  onClick={() => onDirectionChange(key.field, nextDirection)}
                  aria-label={`${fieldLabel}: ${directionLabel(key.direction)}. ${t(
                    "txSort.flipAria",
                  )}`}
                >
                  <span aria-hidden="true">
                    {key.direction === "asc" ? "↑" : "↓"}
                  </span>
                  <span className="tx-sort-direction-text">
                    {directionLabel(key.direction)}
                  </span>
                </button>

                <span className="tx-sort-item-actions">
                  <button
                    type="button"
                    className="tx-sort-icon-btn"
                    onClick={() => onMove(key.field, -1)}
                    disabled={index === 0}
                    aria-label={`${t("txSort.moveUpAria")} ${fieldLabel}`}
                  >
                    <span aria-hidden="true">▲</span>
                  </button>
                  <button
                    type="button"
                    className="tx-sort-icon-btn"
                    onClick={() => onMove(key.field, 1)}
                    disabled={index === sortKeys.length - 1}
                    aria-label={`${t("txSort.moveDownAria")} ${fieldLabel}`}
                  >
                    <span aria-hidden="true">▼</span>
                  </button>
                  <button
                    type="button"
                    className="tx-sort-icon-btn tx-sort-icon-btn--remove"
                    onClick={() => onRemove(key.field)}
                    aria-label={`${t("txSort.removeAria")} ${fieldLabel}`}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="tx-sort-add">
        <label htmlFor={`${uid}-add`} className="tx-sort-add-label">
          {t("txSort.addLabel")}
        </label>
        <select
          id={`${uid}-add`}
          className="tx-sort-add-select"
          // A select is the natural control here, but it has no "chosen"
          // state to keep: picking a field applies it and the control returns
          // to its placeholder, ready for the next addition.
          value=""
          disabled={!canAdd}
          onChange={(event) => {
            const field = event.target.value;
            if (field) onAdd(field as SortField);
          }}
        >
          <option value="">
            {atCapacity ? t("txSort.maxReached") : t("txSort.addPlaceholder")}
          </option>
          {availableFields.map((field) => (
            <option key={field} value={field}>
              {t(SORT_FIELD_LABEL_KEY[field])}
            </option>
          ))}
        </select>
      </div>

      <p className="tx-sort-hint text-body-sm">{t("txSort.hint")}</p>
    </section>
  );
};

export default TransactionSortControl;
