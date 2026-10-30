"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Field,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keydrop/ui";

export type AdminTableColumn = {
  key: string;
  label: string;
  date?: boolean;
  width?: number;
  defaultVisible?: boolean;
  align?: "left" | "center" | "right";
  wrap?: boolean;
  sortable?: boolean;
};

export type AdminTableRow = {
  id: string;
  values: Record<string, string>;
  sortValues?: Record<string, string>;
  cells?: Record<string, ReactNode>;
  facets?: Record<string, string>;
  dateValue?: string;
  searchableValues?: string[];
};

export type AdminTableFilter = {
  key: string;
  label: string;
  options: string[];
};

export function AdminInteractiveTable({
  columns,
  rows,
  filters = [],
  dateFilter,
  searchLabel = "records",
  emptyTitle = "No records found.",
  emptyDescription = "There aren't any records to show yet.",
  initialQuery = "",
  searchPlaceholder,
  density = "default",
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
}: {
  columns: AdminTableColumn[];
  rows: AdminTableRow[];
  filters?: AdminTableFilter[];
  dateFilter?: { key: string; label?: string };
  searchLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  initialQuery?: string;
  searchPlaceholder?: string;
  density?: "compact" | "default" | "comfortable";
  initialPageSize?: number;
  pageSizeOptions?: readonly number[];
}) {
  const tableId = useId();
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const availablePageSizes = pageSizeOptions.length ? pageSizeOptions : [initialPageSize];
  const defaultPageSize = availablePageSizes.includes(initialPageSize)
    ? initialPageSize
    : availablePageSizes[0] ?? 10;
  const [query, setQuery] = useState(initialQuery);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultVisible === false).map(({ key }) => key)),
  );
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const invalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const filtered = rows.filter((row) => {
      const matchesQuery = !needle || (row.searchableValues ?? Object.values(row.values))
        .some((value) => value.toLocaleLowerCase().includes(needle));
      const matchesFilters = filters.every(({ key }) =>
        !selectedFilters[key] || row.facets?.[key] === selectedFilters[key],
      );
      const timestamp = dateFilter && row.dateValue ? Date.parse(row.dateValue) : Number.NaN;
      const matchesFrom = !dateFrom || (Number.isFinite(timestamp)
        && timestamp >= new Date(`${dateFrom}T00:00:00.000Z`).valueOf());
      const matchesTo = !dateTo || (Number.isFinite(timestamp)
        && timestamp < new Date(`${dateTo}T00:00:00.000Z`).valueOf() + 86_400_000);
      return !invalidDateRange && matchesQuery && matchesFilters && matchesFrom && matchesTo;
    });

    if (!sort) return filtered;
    return [...filtered].sort((left, right) => {
      const leftValue = left.sortValues?.[sort.key] ?? left.values[sort.key] ?? "";
      const rightValue = right.sortValues?.[sort.key] ?? right.values[sort.key] ?? "";
      const column = columns.find(({ key }) => key === sort.key);
      const leftDate = column?.date ? Date.parse(leftValue) : Number.NaN;
      const rightDate = column?.date ? Date.parse(rightValue) : Number.NaN;
      const comparison = Number.isFinite(leftDate) && Number.isFinite(rightDate)
        ? leftDate - rightDate
        : leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? comparison : -comparison;
    });
  }, [columns, dateFilter, dateFrom, dateTo, filters, invalidDateRange, query, rows, selectedFilters, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = filteredRows.length ? currentPage * pageSize : 0;
  const pageRows = filteredRows.slice(start, start + pageSize);
  const visibleColumns = columns.filter(({ key }) => !hiddenColumns.has(key));
  const hasActiveFilters = Boolean(query.trim() || dateFrom || dateTo)
    || Object.values(selectedFilters).some(Boolean);

  useEffect(() => {
    const container = tableScrollRef.current;
    const table = container?.querySelector("table");
    if (!container) return;

    const updateOverflow = () => {
      const next = container.scrollWidth > container.clientWidth + 1;
      setHasHorizontalOverflow((current) => current === next ? current : next);
    };

    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(container);
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [columns, pageRows]);

  function updateFilter(key: string, value: string) {
    setSelectedFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  }

  function clearFilters() {
    setQuery("");
    setSelectedFilters({});
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  function toggleSort(column: AdminTableColumn) {
    setSort((current) => current?.key === column.key
      ? { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key: column.key, direction: "asc" });
    setPage(0);
  }

  function toggleColumn(key: string, isVisible: boolean) {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (isVisible) next.delete(key);
      else next.add(key);
      return next;
    });
    if (!isVisible && sort?.key === key) setSort(null);
  }

  return (
    <section className="ad-data-table" aria-label={`${searchLabel} table`} data-density={density}>
      <div className="ad-data-table-toolbar">
        <div
          aria-label={`Search and filter ${searchLabel}`}
          className="ad-data-table-filters"
          role="search"
        >
          <Field className="ad-data-table-search-field">
            <FieldLabel htmlFor={`${tableId}-query`}>Search</FieldLabel>
            <div className="ad-data-table-search">
              <Search aria-hidden="true" />
              <Input
                id={`${tableId}-query`}
                aria-label={`Search ${searchLabel}`}
                placeholder={searchPlaceholder ?? `Search ${searchLabel}…`}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setPage(0);
                }}
              />
            </div>
          </Field>
          {filters.map(({ key, label, options }) => (
            <Field className="ad-filter-field" key={key}>
              <FieldLabel htmlFor={`${tableId}-filter-${key}`}>{label}</FieldLabel>
              <Select
                items={[
                  { value: null, label: "All" },
                  ...options.map((option) => ({ value: option, label: option })),
                ]}
                value={selectedFilters[key] || null}
                onValueChange={(value) => updateFilter(key, value ?? "")}
              >
                <SelectTrigger
                  id={`${tableId}-filter-${key}`}
                  aria-label={`Filter by ${label.toLowerCase()}`}
                >
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={null}>All</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          ))}
          {dateFilter && (
            <fieldset className="ad-date-range">
              <legend>{dateFilter.label ?? "Date range"}</legend>
              <label>
                <span>From</span>
                <Input
                  aria-label={`${dateFilter.label ?? "Date"} from`}
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.currentTarget.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                <span>To</span>
                <Input
                  aria-label={`${dateFilter.label ?? "Date"} to`}
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.currentTarget.value);
                    setPage(0);
                  }}
                />
              </label>
            </fieldset>
          )}
          {hasActiveFilters && (
            <Button className="ad-clear-filters" variant="ghost" size="small" onClick={clearFilters}>
              <RotateCcw aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
        {columns.length > 4 && (
          <div className="ad-column-picker">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button className="ad-column-picker-trigger" variant="outline" size="small" />}
            >
              <Columns3 data-icon="inline-start" aria-hidden="true" />
              Columns
              <span className="ad-column-count">{visibleColumns.length}/{columns.length}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="ad-column-picker-menu">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                {columns.map((column) => {
                  const checked = !hiddenColumns.has(column.key);
                  return (
                    <DropdownMenuCheckboxItem
                      checked={checked}
                      disabled={checked && visibleColumns.length === 1}
                      key={column.key}
                      onCheckedChange={(nextChecked) => toggleColumn(column.key, nextChecked === true)}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        )}
      </div>
      {invalidDateRange && (
        <p className="ad-filter-error" role="alert">The end date must be the same as or later than the start date.</p>
      )}
      <div
        aria-label={hasHorizontalOverflow ? `${searchLabel} table. Scroll horizontally to view all columns.` : undefined}
        className="ad-table-scroll"
        ref={tableScrollRef}
        role={hasHorizontalOverflow ? "region" : undefined}
        tabIndex={hasHorizontalOverflow ? 0 : undefined}
      >
        <Table className="ad-table">
          <caption className="sr-only">{searchLabel}</caption>
          <colgroup>
            {visibleColumns.map((column) => (
              <col key={column.key} style={column.width ? { width: `${column.width}px` } : undefined} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow>{visibleColumns.map((column) => (
              <TableHead
                aria-sort={sort?.key === column.key
                  ? sort.direction === "asc" ? "ascending" : "descending"
                  : "none"}
                data-align={column.align ?? "left"}
                key={column.key}
                scope="col"
              >
                {column.sortable === false ? column.label : (
                  <Button
                    aria-label={`Sort by ${column.label}`}
                    className="ad-sort-button"
                    type="button"
                    variant="ghost"
                    size="small"
                    style={column.width ? { width: `${column.width}px` } : undefined}
                    onClick={() => toggleSort(column)}
                  >
                    {column.label}
                    {sort?.key === column.key
                      ? sort.direction === "asc" ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />
                      : <ArrowUpDown aria-hidden="true" />}
                  </Button>
                )}
              </TableHead>
            ))}</TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length ? pageRows.map((row) => (
              <TableRow key={row.id}>
                {visibleColumns.map((column) => (
                  <TableCell
                    data-align={column.align ?? "left"}
                    data-wrap={column.wrap === false ? "nowrap" : "wrap"}
                    key={column.key}
                  >
                    {row.cells?.[column.key] ?? row.values[column.key] ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell className="ad-empty-row" colSpan={Math.max(visibleColumns.length, 1)}>
                  <strong>{hasActiveFilters ? "No records match these filters." : emptyTitle}</strong>
                  <span>{hasActiveFilters ? "Clear one or more filters to broaden the results." : emptyDescription}</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {hasHorizontalOverflow && (
        <p className="ad-table-overflow-hint" aria-hidden="true">
          Scroll horizontally to view all columns
        </p>
      )}
      <div className="ad-data-table-pagination">
        <p aria-live="polite">
          {filteredRows.length
            ? `Showing ${start + 1}–${Math.min(start + pageSize, filteredRows.length)} of ${filteredRows.length} ${filteredRows.length === 1 ? "record" : "records"}`
            : "0 records"}
        </p>
        <div className="ad-data-table-page-controls">
          <Field className="ad-page-size-field">
            <FieldLabel htmlFor={`${tableId}-page-size`}>Rows per page</FieldLabel>
            <Select
              items={availablePageSizes.map((value) => ({ value: String(value), label: String(value) }))}
              value={String(pageSize)}
              onValueChange={(value) => {
                if (!value) return;
                setPageSize(Number(value));
                setPage(0);
              }}
            >
              <SelectTrigger id={`${tableId}-page-size`} aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {availablePageSizes.map((value) => (
                    <SelectItem key={value} value={String(value)}>{value}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <span className="ad-page-indicator">Page {currentPage + 1} of {pageCount}</span>
          <Button
            aria-label="First page"
            disabled={currentPage === 0}
            onClick={() => setPage(0)}
            size="small"
            variant="outline"
          ><ChevronsLeft aria-hidden="true" /></Button>
          <Button
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            size="small"
            variant="outline"
          ><ChevronLeft aria-hidden="true" /></Button>
          <Button
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            size="small"
            variant="outline"
          ><ChevronRight aria-hidden="true" /></Button>
          <Button
            aria-label="Last page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(pageCount - 1)}
            size="small"
            variant="outline"
          ><ChevronsRight aria-hidden="true" /></Button>
        </div>
      </div>
    </section>
  );
}
