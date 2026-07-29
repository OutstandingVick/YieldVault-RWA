import type { SortField } from "./transactionQuery";

/**
 * i18n key for each sortable field's display name.
 *
 * The column header copy is reused, so a sort key reads as the column it
 * orders. Kept out of `transactionQuery` to leave the filter/sort engine free
 * of presentation concerns, and out of the component modules so both the sort
 * panel and the page can import it without breaking fast refresh.
 */
export const SORT_FIELD_LABEL_KEY: Record<SortField, string> = {
  date: "txHistory.dateHeader",
  amount: "txHistory.amountHeader",
  type: "txHistory.typeHeader",
  status: "txHistory.statusHeader",
};
