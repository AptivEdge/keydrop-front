"use client";

import Link from "next/link";
import { StatusBadge } from "@keydrop/ui";
import type { AdminDataset } from "./admin-data";
import {
  AdminInteractiveTable,
  type AdminTableColumn,
  type AdminTableFilter,
  type AdminTableRow,
} from "./admin-interactive-table";

export function AdminDataTable({
  dataset,
  section,
  initialQuery = "",
}: {
  dataset: AdminDataset;
  section: string;
  initialQuery?: string;
}) {
  const columns: AdminTableColumn[] = dataset.columns.map((label, index) => ({
    key: String(index),
    label,
    date: index === dataset.dateColumn,
    defaultVisible: !dataset.hiddenColumns?.includes(index),
  }));
  const filters: AdminTableFilter[] = (dataset.filters ?? []).map(({ column, label, options }) => ({
    key: String(column),
    label,
    options,
  }));
  const rows: AdminTableRow[] = dataset.rows.map((row) => ({
    id: row.id,
    values: Object.fromEntries(row.values.map((value, index) => [String(index), value])),
    sortValues: dataset.dateColumn === undefined || !row.dateValue
      ? undefined
      : { [String(dataset.dateColumn)]: row.dateValue },
    dateValue: row.dateValue,
    facets: Object.fromEntries((dataset.filters ?? []).map(({ column }) => [
      String(column),
      row.values[column] ?? "",
    ])),
    searchableValues: (dataset.searchColumns ?? row.values.map((_, column) => column))
      .map((column) => row.values[column] ?? ""),
    cells: Object.fromEntries(row.values.map((value, index) => [
      String(index),
      index === 0
        ? <Link className="kd-mono" href={`/${section}/${encodeURIComponent(row.id)}`}>{value}</Link>
        : index === dataset.statusColumn
          ? <StatusBadge status={value} />
          : value,
    ])),
  }));

  return (
    <AdminInteractiveTable
      columns={columns}
      dateFilter={dataset.dateColumn === undefined ? undefined : { key: String(dataset.dateColumn) }}
      emptyDescription="The API returned no user records."
      emptyTitle="No user records found."
      filters={filters}
      initialQuery={initialQuery}
      rows={rows}
      searchPlaceholder={dataset.title === "Users" ? "Search by email or user ID…" : undefined}
      searchLabel={dataset.title.toLowerCase()}
    />
  );
}
