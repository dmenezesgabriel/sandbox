/**
 * Title: Dive into Pivoting!
 * Description: Interactive pivot table experience. Browse databases/schemas/tables, drag columns into Filters, Columns, Rows, and Values quadrants to dynamically build pivot queries using the pivot_table_functions database (build_column_names and pivot_table). Requires the pivot_table_functions shared database to be attached.
 * Dive ID: 1776b48d-4d39-48ea-91c6-c1c05ab8f5e0
 */

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useSQLQuery } from "@motherduck/react-sql-query";
import {
  Loader2,
  ChevronRight,
  ChevronDown,
  Database,
  X,
  Plus,
  Table2,
  Filter,
  MoreVertical,
  Code,
  Terminal,
  Play,
  BarChart3,
  Settings,
  LayoutDashboard,
  HelpCircle,
  Send,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  BarChart as ReBarChart, Bar, LineChart as ReLineChart, Line,
  AreaChart as ReAreaChart, Area, ScatterChart as ReScatterChart, Scatter,
  PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceArea,
} from "recharts";


const N = (v: unknown): number => (v != null ? Number(v) : 0);

/* ── Shared column type detection & comparison ─────────────────── */
type ColType = 'number' | 'date' | 'string';

function detectColumnType(col: string, rows: Record<string, unknown>[]): ColType {
  for (const row of rows) {
    const v = row[col];
    if (v == null || v === '') continue;
    if (typeof v === 'number' || typeof v === 'bigint') return 'number';
    if (v instanceof Date) return 'date';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return 'date';
    return 'string';
  }
  return 'string';
}

function compareValues(a: string, b: string, op: string, colType: ColType): boolean {
  if (colType === 'number') {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (isNaN(na) || isNaN(nb)) return false;
    switch (op) {
      case '>': return na > nb;
      case '<': return na < nb;
      case '>=': return na >= nb;
      case '<=': return na <= nb;
      case '==': return na === nb;
      default: return false;
    }
  }
  if (colType === 'date') {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    if (isNaN(da) || isNaN(db)) return false;
    switch (op) {
      case '>': return da > db;
      case '<': return da < db;
      case '>=': return da >= db;
      case '<=': return da <= db;
      case '==': return da === db;
      default: return false;
    }
  }
  // string fallback — lexicographic
  switch (op) {
    case '>': return a > b;
    case '<': return a < b;
    case '>=': return a >= b;
    case '<=': return a <= b;
    case '==': return a === b;
    default: return false;
  }
}

/* ── Shared sort types & utilities ────────────────────────────── */
type SortColumn = { col: string; direction: 'asc' | 'desc' };

function buildOrderByClause(sortColumns: SortColumn[], rowColumns?: Set<string>): string {
  if (sortColumns.length === 0) return '';
  const parts = sortColumns.map(s => {
    const escaped = s.col.replace(/"/g, '""');
    const quoted = `"${escaped}"`;
    const dir = s.direction.toUpperCase();
    if (rowColumns && rowColumns.has(s.col)) {
      return `CASE WHEN ${quoted} = 'Subtotal' THEN 'zzzSubtotal' WHEN ${quoted} = 'Grand Total' THEN 'zzzzGrand Total' ELSE CAST(${quoted} AS VARCHAR) END ${dir}`;
    }
    return `${quoted} ${dir}`;
  });
  return ' ORDER BY ' + parts.join(', ');
}

function cycleSortColumn(prev: SortColumn[], col: string): SortColumn[] {
  const idx = prev.findIndex(s => s.col === col);
  if (idx === -1) return [...prev, { col, direction: 'desc' }];
  if (prev[idx].direction === 'desc') {
    const next = [...prev];
    next[idx] = { col, direction: 'asc' };
    return next;
  }
  return prev.filter(s => s.col !== col);
}

function SortIndicator({ direction, order }: { direction: 'asc' | 'desc'; order: number }) {
  const isAsc = direction === 'asc';
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" style={{ flexShrink: 0, verticalAlign: 'middle' }}>
      {isAsc ? (
        <polygon points="8,1 15,15 1,15" fill="#22a34a" />
      ) : (
        <polygon points="8,15 15,1 1,1" fill="#22a34a" />
      )}
      <text x="8" y={isAsc ? "12.5" : "9"} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold"
        style={{ userSelect: 'none' }}>{order}</text>
    </svg>
  );
}

/* ── Pagination Bar ───────────────────────────────────────────── */
function PaginationBar({ page, totalRows, rowLimit, onPageChange }: {
  page: number; totalRows: number; rowLimit: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalRows / rowLimit);
  if (totalPages <= 1) return null;

  // Show a window of up to 10 page buttons
  const maxButtons = 10;
  let startPage = Math.max(0, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons);
  if (endPage - startPage < maxButtons) startPage = Math.max(0, endPage - maxButtons);

  const firstRow = page * rowLimit + 1;
  const lastRow = Math.min((page + 1) * rowLimit, totalRows);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: active ? '1px solid #0777b3' : '1px solid #d0d0d0', borderRadius: 4, cursor: 'pointer',
    background: active ? '#0777b3' : '#fff', color: active ? '#fff' : '#333',
    fontSize: 11, fontWeight: active ? 600 : 400, fontFamily: 'inherit', padding: 0, flexShrink: 0,
  });
  const arrowStyle = (disabled: boolean): React.CSSProperties => ({
    width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #d0d0d0', borderRadius: 4, cursor: disabled ? 'default' : 'pointer',
    background: '#fff', color: disabled ? '#ccc' : '#333',
    fontSize: 13, fontFamily: 'inherit', padding: 0, flexShrink: 0, opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6a6a6a', flexShrink: 0 }}>
      <button style={arrowStyle(page === 0)} onClick={() => page > 0 && onPageChange(0)} disabled={page === 0} title="First page">{'\u00ab'}</button>
      <button style={arrowStyle(page === 0)} onClick={() => page > 0 && onPageChange(page - 1)} disabled={page === 0} title="Previous page">{'\u2039'}</button>
      {Array.from({ length: endPage - startPage }, (_, i) => {
        const p = startPage + i;
        return (
          <button key={p} style={btnStyle(p === page)} onClick={() => onPageChange(p)}>
            {p + 1}
          </button>
        );
      })}
      <button style={arrowStyle(page === totalPages - 1)} onClick={() => page < totalPages - 1 && onPageChange(page + 1)} disabled={page === totalPages - 1} title="Next page">{'\u203a'}</button>
      <button style={arrowStyle(page === totalPages - 1)} onClick={() => page < totalPages - 1 && onPageChange(totalPages - 1)} disabled={page === totalPages - 1} title="Last page">{'\u00bb'}</button>
      <span style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
        {firstRow.toLocaleString()} – {lastRow.toLocaleString()} of {totalRows.toLocaleString()}
      </span>
    </div>
  );
}

/* ── Column Filter Dropdown ─────────────────────────────────────── */
function ColumnFilterDropdown({
  col,
  pivotData,
  cascadedData,
  currentSelection,
  onApply,
  onCancel,
  applyRef,
}: {
  col: string;
  pivotData: Record<string, unknown>[];
  cascadedData?: Record<string, unknown>[];
  currentSelection: Set<string> | null; // null = show all
  onApply: (selected: Set<string> | null) => void;
  onCancel: () => void;
  applyRef?: { current: (() => void) | null };
}) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("like" as "like" | ">" | "<" | ">=" | "<=" | "==");
  const [pending, setPending] = useState<Set<string>>(() => {
    if (currentSelection) return new Set(currentSelection);
    // null means "all" — start with all values selected
    const all = new Set<string>();
    for (const row of pivotData) {
      all.add(String(row[col] ?? ""));
    }
    return all;
  });
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // All unique values in the column, sorted alphabetically
  const allValues = useMemo(() => {
    const s = new Set<string>();
    for (const row of pivotData) {
      s.add(String(row[col] ?? ""));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [pivotData, col]);

  // Values present in cascaded (other-filter-applied) data
  const availableValues = useMemo(() => {
    const data = cascadedData || pivotData;
    const s = new Set<string>();
    for (const row of data) s.add(String(row[col] ?? ""));
    return s;
  }, [cascadedData, pivotData, col]);

  const hasCascading = !!cascadedData && cascadedData !== pivotData;

  const colType = useMemo(() => detectColumnType(col, pivotData), [pivotData, col]);
  const isComparable = colType === 'number' || colType === 'date';

  // Filtered + limited values based on search and filterMode, split by availability
  const { filteredAvailable, filteredUnavailableSelected } = useMemo(() => {
    const q = search.trim();
    let base: string[];
    if (!q) {
      base = allValues;
    } else if (filterMode === "like" || !isComparable) {
      const lq = q.toLowerCase();
      base = allValues.filter((v) => v.toLowerCase().includes(lq));
    } else {
      base = allValues.filter((v) => compareValues(v, q, filterMode, colType));
    }
    const available = base.filter(v => availableValues.has(v)).slice(0, 1000);
    const unavailableSelected = base.filter(v => !availableValues.has(v) && pending.has(v)).slice(0, 200);
    return { filteredAvailable: available, filteredUnavailableSelected: unavailableSelected };
  }, [allValues, search, filterMode, isComparable, colType, availableValues, pending]);

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightIdx(-1);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-filter-option]");
    items[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  const toggleValue = (val: string) => {
    setHasManualSelection(true);
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  // Unavailable values can only be deselected, never re-selected
  const toggleUnavailableValue = (val: string) => {
    setHasManualSelection(true);
    setPending((prev) => {
      if (!prev.has(val)) return prev;
      const next = new Set(prev);
      next.delete(val);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setHasManualSelection(true);
    setPending((prev) => {
      const next = new Set(prev);
      for (const v of filteredAvailable) next.add(v);
      return next;
    });
  };

  const selectNoneFiltered = () => {
    setHasManualSelection(true);
    setPending((prev) => {
      const next = new Set(prev);
      for (const v of filteredAvailable) next.delete(v);
      for (const v of filteredUnavailableSelected) next.delete(v);
      return next;
    });
  };

  const handleApply = () => {
    const hasSearch = search.trim() !== "";

    if (hasSearch && !hasManualSelection) {
      // No manual interaction — filter to just the search results
      if (filteredAvailable.length === allValues.length) {
        onApply(null);
      } else {
        onApply(new Set(filteredAvailable));
      }
    } else if (hasSearch && hasManualSelection) {
      // Manual selections made — add search results to pending
      const merged = new Set<string>(pending);
      for (const v of filteredAvailable) merged.add(v);
      if (merged.size === allValues.length) {
        onApply(null);
      } else {
        onApply(merged);
      }
    } else {
      // No search — apply pending as-is
      // If all available values are selected (and no unavailable stragglers), clear filter entirely
      const allAvailableSelected = filteredAvailable.length > 0 && filteredAvailable.every(v => pending.has(v)) && filteredUnavailableSelected.length === 0;
      if (pending.size === allValues.length || allAvailableSelected) {
        onApply(null);
      } else {
        onApply(new Set(pending));
      }
    }
  };

  const handleEscape = () => {
    onCancel();
  };

  // Register apply handler so parent outside-click can trigger it
  useEffect(() => {
    if (applyRef) applyRef.current = handleApply;
    return () => { if (applyRef) applyRef.current = null; };
  });

  const totalNavigable = filteredAvailable.length + filteredUnavailableSelected.length;

  const handleKeyDown = (e: any) => {
    const isInput = (e.target as HTMLElement).tagName === "INPUT";
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, totalNavigable - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === " " && highlightIdx >= 0 && !isInput) {
      e.preventDefault();
      if (highlightIdx < filteredAvailable.length) {
        toggleValue(filteredAvailable[highlightIdx]);
      } else {
        toggleUnavailableValue(filteredUnavailableSelected[highlightIdx - filteredAvailable.length]);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleEscape();
    }
  };

  const isAllFilteredSelected = filteredAvailable.every((v) => pending.has(v));
  const isNoneFilteredSelected = filteredAvailable.every((v) => !pending.has(v)) && filteredUnavailableSelected.length === 0;

  return (
    <div
      data-filter-popup="true"
      onKeyDown={handleKeyDown}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        background: "#fff",
        border: "1px solid #d0d0d0",
        borderRadius: 6,
        zIndex: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        width: isComparable ? 260 : 220,
        display: "flex",
        flexDirection: "column",
        maxHeight: 350,
      }}
    >
      {/* Search box with optional operator dropdown for numeric/date columns */}
      <div style={{ padding: "8px 8px 4px", display: "flex", gap: 4, alignItems: "center" }}>
        {isComparable && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              title={filterMode === "like" ? "Contains search (text match)" : `Comparison: ${filterMode}`}
              style={{
                fontSize: 11,
                padding: "4px 2px",
                border: "1px solid #d0d0d0",
                borderRadius: 4,
                outline: "none",
                fontFamily: "inherit",
                background: "#fff",
                cursor: "pointer",
                width: 46,
                color: filterMode === "like" ? "#6a6a6a" : "#0777b3",
                fontWeight: filterMode === "like" ? 400 : 600,
                textAlign: "center",
                boxSizing: "border-box",
                height: 27,
              }}
            >
              <option value="like" title="Contains search — filters values whose text contains the search term">like</option>
              <option value=">" title="Greater than">&gt;</option>
              <option value="<" title="Less than">&lt;</option>
              <option value=">=" title="Greater than or equal">&gt;=</option>
              <option value="<=" title="Less than or equal">&lt;=</option>
              <option value="==" title="Equal to">==</option>
            </select>
          </div>
        )}
        <input
          ref={searchRef}
          autoFocus
          placeholder={isComparable && filterMode !== "like" ? (colType === 'date' ? "e.g. 2024-01-01..." : "Enter number...") : "Search..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type={colType === 'number' && filterMode !== "like" ? "number" : "text"}
          style={{
            fontSize: 11,
            padding: "5px 8px",
            border: "1px solid #d0d0d0",
            borderRadius: 4,
            outline: "none",
            width: "100%",
            fontFamily: "inherit",
            boxSizing: "border-box",
            flex: 1,
            minWidth: 0,
          }}
        />
      </div>
      {/* All / None */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "2px 8px 4px",
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <button
          onClick={selectAllFiltered}
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            background: "#0777b3",
            border: "1px solid #0777b3",
            cursor: "pointer",
            padding: "1px 6px",
            borderRadius: 3,
            opacity: isAllFilteredSelected ? 0.5 : 1,
          }}
        >
          All
        </button>
        <button
          onClick={selectNoneFiltered}
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#333",
            background: "#fff",
            border: "1px solid #ccc",
            cursor: "pointer",
            padding: "1px 6px",
            borderRadius: 3,
            opacity: isNoneFilteredSelected ? 0.5 : 1,
          }}
        >
          None
        </button>
        <span
          style={{
            fontSize: 10,
            color: "#999",
            marginLeft: "auto",
            alignSelf: "center",
          }}
        >
          {pending.size}/{allValues.length}{hasCascading && availableValues.size < allValues.length ? ` (${availableValues.size} avail)` : ""}
        </span>
      </div>
      {/* Scrollable option list */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "4px 0",
          minHeight: 0,
        }}
      >
        {filteredAvailable.length === 0 && filteredUnavailableSelected.length === 0 && (
          <div
            style={{
              fontSize: 11,
              color: "#999",
              padding: "8px 12px",
              textAlign: "center",
            }}
          >
            No matches
          </div>
        )}
        {/* Available values */}
        {filteredAvailable.map((val, i) => {
          const checked = pending.has(val);
          const highlighted = i === highlightIdx;
          return (
            <div
              key={val}
              data-filter-option="true"
              onClick={() => toggleValue(val)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                cursor: "pointer",
                fontSize: 11,
                background: highlighted ? "#f0f4f8" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!highlighted) e.currentTarget.style.background = "#f8f8f8";
                setHighlightIdx(i);
              }}
              onMouseLeave={(e) => {
                if (!highlighted) e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: checked
                    ? "1px solid #0777b3"
                    : "1px solid #ccc",
                  background: checked ? "#0777b3" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {checked && (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={val}
              >
                {val || <i style={{ color: "#999" }}>(empty)</i>}
              </span>
            </div>
          );
        })}
        {/* Unavailable but selected values — greyed out, can only deselect */}
        {filteredUnavailableSelected.length > 0 && (
          <div style={{
            borderTop: "1px dashed #d0d0d0",
            margin: "4px 8px 2px",
            paddingTop: 4,
          }}>
            <div style={{ fontSize: 9, color: "#999", padding: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              not in filtered data
            </div>
          </div>
        )}
        {filteredUnavailableSelected.map((val, i) => {
          const globalIdx = filteredAvailable.length + i;
          const checked = pending.has(val);
          const highlighted = globalIdx === highlightIdx;
          return (
            <div
              key={`unavail-${val}`}
              data-filter-option="true"
              onClick={() => toggleUnavailableValue(val)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 8px",
                cursor: "pointer",
                fontSize: 11,
                opacity: 0.5,
                background: highlighted ? "#f0f4f8" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!highlighted) e.currentTarget.style.background = "#f8f8f8";
                setHighlightIdx(globalIdx);
              }}
              onMouseLeave={(e) => {
                if (!highlighted) e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: checked
                    ? "1px solid #0777b3"
                    : "1px solid #ccc",
                  background: checked ? "#0777b3" : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {checked && (
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={val}
              >
                {val || <i style={{ color: "#999" }}>(empty)</i>}
              </span>
            </div>
          );
        })}
      </div>
      {/* Cancel / Apply */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 6,
          padding: "6px 8px",
          borderTop: "1px solid #e8e8e8",
        }}
      >
        <button
          onClick={onCancel}
          style={{
            fontSize: 11,
            padding: "4px 12px",
            border: "1px solid #d0d0d0",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          style={{
            fontSize: 11,
            padding: "4px 12px",
            border: "none",
            borderRadius: 4,
            background: "#0777b3",
            color: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 600,
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

const sq = (s: string) => s.replace(/'/g, "''");
const dq = (s: string) => `"${s.replace(/"/g, '""')}"`;
const hasColumnsAndMultipleValues = (columnItems: { col: string }[], valueItems: { expr: string }[], valuesAxis: 'columns' | 'rows' | null): boolean =>
  columnItems.length >= 1 && valueItems.length >= 2 && valuesAxis !== 'rows';
const prettyColName = (col: string, columnItems: { col: string }[], valueItems: { expr: string }[], valuesAxis: 'columns' | 'rows' | null): string => {
  let s = col.replace(/\|\|\|/g, ' ');
  if (hasColumnsAndMultipleValues(columnItems, valueItems, valuesAxis)) {
    let prefix = s, suffix = '';
    if (s.endsWith(')')) {
      const openIdx = s.lastIndexOf('(');
      if (openIdx > 0) { prefix = s.slice(0, openIdx); suffix = s.slice(openIdx); }
    }
    const lastUnderscore = prefix.lastIndexOf('_');
    if (lastUnderscore > 0) prefix = prefix.slice(0, lastUnderscore) + ' ' + prefix.slice(lastUnderscore + 1);
    s = prefix + suffix;
  }
  return s;
};
const sqlList = (items: string[]): string => {
  const clean = items.filter((s): s is string => s != null);
  if (clean.length === 0) return "[]";
  return "[" + clean.map((s) => `'${sq(s)}'`).join(", ") + "]";
};

/* ── SQL Tokenizer & Editor ────────────────────────────────────── */
function tokenizeSql(sql: string, keywords: Set<string>): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < sql.length) {
    // Single-line comment
    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const commentEnd = end === -1 ? sql.length : end;
      tokens.push(<span key={key++} style={{ color: "#999" }}>{sql.slice(i, commentEnd)}</span>);
      i = commentEnd;
      continue;
    }
    // Block comment
    if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const commentEnd = end === -1 ? sql.length : end + 2;
      tokens.push(<span key={key++} style={{ color: "#999" }}>{sql.slice(i, commentEnd)}</span>);
      i = commentEnd;
      continue;
    }
    // String literal
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      tokens.push(<span key={key++} style={{ color: "#2d7a00" }}>{sql.slice(i, j)}</span>);
      i = j;
      continue;
    }
    // Word (identifier or keyword)
    if (/[a-zA-Z_]/.test(sql[i])) {
      let j = i + 1;
      while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      if (keywords.has(word.toUpperCase())) {
        tokens.push(<span key={key++} style={{ color: "#0777b3", fontWeight: 600 }}>{word}</span>);
      } else {
        tokens.push(<span key={key++}>{word}</span>);
      }
      i = j;
      continue;
    }
    // Collect consecutive non-special characters
    let j = i + 1;
    while (
      j < sql.length &&
      !/[a-zA-Z_]/.test(sql[j]) &&
      sql[j] !== "'" &&
      sql[j] !== "-" &&
      sql[j] !== "/"
    ) {
      j++;
    }
    tokens.push(<span key={key++}>{sql.slice(i, j)}</span>);
    i = j;
  }
  return tokens;
}

const SQL_EDITOR_FONT: React.CSSProperties = {
  fontFamily: 'ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Monaco, Consolas, monospace',
  fontSize: 12,
  lineHeight: "20px",
};

function SqlEditor({
  value,
  onChange,
  keywords,
  onRun,
}: {
  value: string;
  onChange: (v: string) => void;
  keywords: Set<string>;
  onRun?: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = ta.scrollTop;
    }
  }, []);

  const highlighted = useMemo(() => tokenizeSql(value, keywords), [value, keywords]);
  const lineCount = Math.max(value.split("\n").length, 1);
  const gutterWidth = Math.max(30, String(lineCount).length * 9 + 16);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = textareaRef.current!;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const nv = value.substring(0, start) + "  " + value.substring(end);
      onChange(nv);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
    if (e.shiftKey && e.key === "Enter" && onRun) {
      e.preventDefault();
      onRun();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        overflow: "hidden",
        background: "#fff",
        borderRadius: 4,
        border: "1px solid #d0d0d0",
        minHeight: 80,
      }}
    >
      {/* Line numbers */}
      <div
        ref={lineNumRef}
        style={{
          ...SQL_EDITOR_FONT,
          padding: "8px 0",
          textAlign: "right",
          color: "#adadad",
          userSelect: "none",
          overflow: "hidden",
          flexShrink: 0,
          width: gutterWidth,
          background: "#fafafa",
          borderRight: "1px solid #e8e8e8",
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ paddingRight: 8, paddingLeft: 8, height: 20 }}>
            {i + 1}
          </div>
        ))}
      </div>
      {/* Code area */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <pre
          ref={preRef}
          aria-hidden="true"
          style={{
            ...SQL_EDITOR_FONT,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            margin: 0,
            padding: 8,
            color: "#231f20",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {highlighted}
          {"\n"}
        </pre>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          placeholder="Enter SQL query..."
          style={{
            ...SQL_EDITOR_FONT,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            margin: 0,
            padding: 8,
            border: "none",
            outline: "none",
            resize: "none",
            background: "transparent",
            color: "transparent",
            caretColor: "#231f20",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            overflow: "auto",
            boxSizing: "border-box",
          }}
        />
      </div>
    </div>
  );
}

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

interface QuadItem {
  id: string;
  expr: string;
  col?: string;
}

interface DimItem {
  id: string;
  col: string;
  granularity?: string;
}

const TIMESTAMP_GRANULARITIES: { key: string; label: string; truncPart: string }[] = [
  { key: 'year', label: 'Year', truncPart: 'year' },
  { key: 'yearmonth', label: 'Year Month', truncPart: 'month' },
  { key: 'yearweek', label: 'Year Week', truncPart: 'week' },
  { key: 'date', label: 'Date', truncPart: 'day' },
  { key: 'date_hour', label: 'Date Hour', truncPart: 'hour' },
  { key: 'date_hour_minute', label: 'Date Hour Minute', truncPart: 'minute' },
  { key: 'date_hour_minute_second', label: 'Date Hour Min Sec', truncPart: 'second' },
  { key: '', label: 'Raw Timestamp', truncPart: '' },
];

const DATE_GRANULARITIES: { key: string; label: string; truncPart: string }[] = [
  { key: 'year', label: 'Year', truncPart: 'year' },
  { key: 'yearmonth', label: 'Year Month', truncPart: 'month' },
  { key: 'yearweek', label: 'Year Week', truncPart: 'week' },
  { key: '', label: 'Date (raw)', truncPart: '' },
];

const dimColName = (d: DimItem): string => d.granularity ? `${d.col}_${d.granularity}` : d.col;
const dimColNames = (items: DimItem[]): string[] => items.map(dimColName);
const isDateLike = (dtype: string) => /TIMESTAMP|DATE/i.test(dtype);
const isTimestampLike = (dtype: string) => /TIMESTAMP/i.test(dtype);

interface FilterMeta {
  col: string;
  mode: "like" | ">" | "<" | ">=" | "<=" | "==";
  selectedValues: string[];
  searchText: string;
}

interface ConditionalFormatRule {
  id: string;
  applyTo: 'row' | string; // 'row' for entire row, or column name
  conditionColumn: string;
  operator: 'like' | '>' | '<' | '>=' | '<=' | '==' | '!=' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with';
  value: string;
  fontColor?: string;
  bgColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

/* ── Shared conditional formatting evaluation ──────────────────── */
function getConditionalStyle(row: Record<string, unknown>, col: string, rules: ConditionalFormatRule[], colTypes: Record<string, ColType>): React.CSSProperties {
  const style: React.CSSProperties = {};
  for (const rule of rules) {
    if (rule.applyTo !== 'row' && rule.applyTo !== col) continue;
    const cellVal = String(row[rule.conditionColumn] ?? '');
    const ruleVal = rule.value;
    let matches = false;
    const ct = colTypes[rule.conditionColumn] || 'string';
    switch (rule.operator) {
      case '==': matches = ct === 'number' ? compareValues(cellVal, ruleVal, '==', ct) : cellVal === ruleVal; break;
      case '!=': matches = ct === 'number' ? !compareValues(cellVal, ruleVal, '==', ct) : cellVal !== ruleVal; break;
      case '>': case '<': case '>=': case '<=':
        matches = compareValues(cellVal, ruleVal, rule.operator, ct);
        break;
      case 'like': case 'contains': matches = cellVal.toLowerCase().includes(ruleVal.toLowerCase()); break;
      case 'not_contains': matches = !cellVal.toLowerCase().includes(ruleVal.toLowerCase()); break;
      case 'starts_with': matches = cellVal.toLowerCase().startsWith(ruleVal.toLowerCase()); break;
      case 'ends_with': matches = cellVal.toLowerCase().endsWith(ruleVal.toLowerCase()); break;
    }
    if (matches) {
      if (rule.fontColor) style.color = rule.fontColor;
      if (rule.bgColor) style.background = rule.bgColor;
      if (rule.bold) style.fontWeight = 600;
      if (rule.italic) style.fontStyle = 'italic';
      if (rule.underline) style.textDecoration = 'underline';
    }
  }
  return style;
}

/* ── Filter Quadrant Dropdown ──────────────────────────────────── */
function FilterQuadDropdown({
  col,
  fromExpr,
  initialMeta,
  onApply,
  onCancel,
  applyRef,
}: {
  col: string;
  fromExpr: string;
  initialMeta?: FilterMeta;
  onApply: (expr: string, meta: FilterMeta) => void;
  onCancel: () => void;
  applyRef?: { current: (() => void) | null };
}) {
  const [search, setSearch] = useState(initialMeta?.searchText ?? "");
  const [filterMode, setFilterMode] = useState<"like" | ">" | "<" | ">=" | "<=" | "==">(initialMeta?.mode ?? "like");
  const [pending, setPending] = useState<Set<string>>(() =>
    initialMeta?.selectedValues ? new Set(initialMeta.selectedValues) : new Set<string>()
  );
  const [initialized, setInitialized] = useState(!!initialMeta?.selectedValues);
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const distinctSql = `SELECT DISTINCT ${dq(col)}::VARCHAR as val FROM ${fromExpr} WHERE ${dq(col)} IS NOT NULL ORDER BY 1 LIMIT 1000`;
  const distinctQ = useSQLQuery(distinctSql);

  const allValues = useMemo(() => {
    const rows = Array.isArray(distinctQ.data) ? distinctQ.data : [];
    return rows.map((r) => String(r.val ?? "")).sort((a, b) => a.localeCompare(b));
  }, [distinctQ.data]);

  useEffect(() => {
    if (!initialized && allValues.length > 0) {
      setPending(new Set(allValues));
      setInitialized(true);
    }
  }, [allValues, initialized]);

  const colType = useMemo((): ColType => {
    for (const v of allValues) {
      if (v !== '') {
        if (!isNaN(Number(v)) && v.trim() !== '') return 'number';
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return 'date';
        return 'string';
      }
    }
    return 'string';
  }, [allValues]);
  const isComparable = colType === 'number' || colType === 'date';

  const filteredValues = useMemo(() => {
    const q = search.trim();
    if (!q) return allValues.slice(0, 1000);
    if (filterMode === "like" || !isComparable) {
      const lq = q.toLowerCase();
      return allValues.filter((v) => v.toLowerCase().includes(lq)).slice(0, 1000);
    }
    return allValues.filter((v) => compareValues(v, q, filterMode, colType)).slice(0, 1000);
  }, [allValues, search, filterMode, isComparable, colType]);

  useEffect(() => { setHighlightIdx(-1); }, [search]);
  useEffect(() => {
    if (highlightIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-filter-option]");
    items[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  const toggleValue = (val: string) => {
    setHasManualSelection(true);
    setPending((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val); else next.add(val);
      return next;
    });
  };
  const selectAllFiltered = () => {
    setHasManualSelection(true);
    setPending((prev) => { const next = new Set(prev); for (const v of filteredValues) next.add(v); return next; });
  };
  const selectNoneFiltered = () => {
    setHasManualSelection(true);
    setPending((prev) => { const next = new Set(prev); for (const v of filteredValues) next.delete(v); return next; });
  };

  const buildSqlSnippet = (): { expr: string; meta: FilterMeta } => {
    const quotedCol = dq(col);
    const hasSearch = search.trim() !== "";
    if (filterMode !== "like" && isComparable && hasSearch) {
      const op = filterMode === "==" ? "=" : filterMode;
      const val = colType === 'date' ? `'${sq(search.trim())}'` : search.trim();
      return {
        expr: `${quotedCol} ${op} ${val}`,
        meta: { col, mode: filterMode, selectedValues: Array.from(pending), searchText: search },
      };
    }
    let values: string[];
    if (hasSearch && !hasManualSelection) {
      values = filteredValues;
    } else if (hasSearch && hasManualSelection) {
      const merged = new Set<string>(pending);
      for (const v of filteredValues) merged.add(v);
      values = Array.from(merged);
    } else {
      values = Array.from(pending);
    }
    let expr: string;
    if (values.length === 0) {
      expr = `1=0`;
    } else if (values.length === allValues.length && allValues.length > 0) {
      expr = `1=1`;
    } else {
      expr = `${quotedCol} IN (${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",")})`;
    }
    return { expr, meta: { col, mode: filterMode, selectedValues: Array.from(pending), searchText: search } };
  };

  const handleApply = () => {
    const { expr, meta } = buildSqlSnippet();
    onApply(expr, meta);
  };

  useEffect(() => {
    if (applyRef) applyRef.current = handleApply;
    return () => { if (applyRef) applyRef.current = null; };
  });

  const handleKeyDown = (e: any) => {
    const isInput = (e.target as HTMLElement).tagName === "INPUT";
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, filteredValues.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === " " && highlightIdx >= 0 && !isInput) { e.preventDefault(); toggleValue(filteredValues[highlightIdx]); }
    else if (e.key === "Enter") { e.preventDefault(); handleApply(); }
    else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  };

  const isAllFilteredSelected = filteredValues.every((v) => pending.has(v));
  const isNoneFilteredSelected = filteredValues.every((v) => !pending.has(v));

  return (
    <div
      data-filter-quad-popup="true"
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        background: "#fff",
        border: "1px solid #d0d0d0",
        borderRadius: 6,
        zIndex: 100,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        width: isComparable ? 260 : 220,
        display: "flex",
        flexDirection: "column",
        maxHeight: 350,
      }}
    >
      <div style={{ padding: "8px 8px 4px", display: "flex", gap: 4, alignItems: "center" }}>
        {isComparable && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              style={{
                fontSize: 11, padding: "4px 2px", border: "1px solid #d0d0d0", borderRadius: 4,
                outline: "none", fontFamily: "inherit", background: "#fff", cursor: "pointer",
                width: 46, color: filterMode === "like" ? "#6a6a6a" : "#0777b3",
                fontWeight: filterMode === "like" ? 400 : 600, textAlign: "center",
                boxSizing: "border-box" as const, height: 27,
              }}
            >
              <option value="like">like</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="==">==</option>
            </select>
          </div>
        )}
        <input
          ref={searchRef}
          autoFocus
          placeholder={isComparable && filterMode !== "like" ? (colType === 'date' ? "e.g. 2024-01-01..." : "Enter number...") : "Search..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type={colType === 'number' && filterMode !== "like" ? "number" : "text"}
          style={{
            fontSize: 11, padding: "5px 8px", border: "1px solid #d0d0d0", borderRadius: 4,
            outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" as const,
            flex: 1, minWidth: 0,
          }}
        />
      </div>
      {distinctQ.isLoading ? (
        <div style={{ padding: 12, fontSize: 11, color: "#6a6a6a", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 className="animate-spin" size={12} /> Loading values...
        </div>
      ) : distinctQ.isError ? (
        <div style={{ padding: "8px 12px", fontSize: 11, color: "#bc1200" }}>Error loading values</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 2, padding: "2px 8px 4px", borderBottom: "1px solid #e8e8e8" }}>
            <button onClick={selectAllFiltered} style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "#0777b3", border: "1px solid #0777b3", cursor: "pointer", padding: "1px 6px", borderRadius: 3, opacity: isAllFilteredSelected ? 0.5 : 1 }}>All</button>
            <button onClick={selectNoneFiltered} style={{ fontSize: 10, fontWeight: 600, color: "#333", background: "#fff", border: "1px solid #ccc", cursor: "pointer", padding: "1px 6px", borderRadius: 3, opacity: isNoneFilteredSelected ? 0.5 : 1 }}>None</button>
            <span style={{ fontSize: 10, color: "#999", marginLeft: "auto", alignSelf: "center" }}>{pending.size}/{allValues.length}</span>
          </div>
          <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "4px 0", minHeight: 0 }}>
            {filteredValues.length === 0 && (
              <div style={{ fontSize: 11, color: "#999", padding: "8px 12px", textAlign: "center" }}>No matches</div>
            )}
            {filteredValues.map((val, i) => {
              const checked = pending.has(val);
              const highlighted = i === highlightIdx;
              return (
                <div key={val} data-filter-option="true" onClick={() => toggleValue(val)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, background: highlighted ? "#f0f4f8" : "transparent" }}
                  onMouseEnter={(e) => { if (!highlighted) e.currentTarget.style.background = "#f8f8f8"; setHighlightIdx(i); }}
                  onMouseLeave={(e) => { if (!highlighted) e.currentTarget.style.background = "transparent"; }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: checked ? "1px solid #0777b3" : "1px solid #ccc",
                    background: checked ? "#0777b3" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {checked && (
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={val}>
                    {val || <i style={{ color: "#999" }}>(empty)</i>}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, padding: "6px 8px", borderTop: "1px solid #e8e8e8" }}>
        <button onClick={onCancel} style={{ fontSize: 11, padding: "4px 12px", border: "1px solid #d0d0d0", borderRadius: 4, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={handleApply} style={{ fontSize: 11, padding: "4px 12px", border: "none", borderRadius: 4, background: "#0777b3", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Apply</button>
      </div>
    </div>
  );
}

const AGGREGATE_FUNCTIONS: { name: string; desc: string }[] = [
  { name: "SUM", desc: "Calculates the sum value for all tuples in arg." },
  { name: "COUNT", desc: "Returns the number of non-NULL values in arg." },
  { name: "AVG", desc: "Calculates the average value for all tuples in x." },
  { name: "MIN", desc: "Returns the minimum value present in arg." },
  { name: "MAX", desc: "Returns the maximum value present in arg." },
  { name: "MEDIAN", desc: "Returns the middle value of the set. NULL values are ignored. For even value counts, numeric types return the average of the two middle values." },
  { name: "MODE", desc: "Returns the most frequent value for the values within x. NULL values are ignored." },
  { name: "STDDEV", desc: "Returns the sample standard deviation." },
  { name: "STDDEV_POP", desc: "Returns the population standard deviation." },
  { name: "VARIANCE", desc: "Returns the sample variance of all input values." },
  { name: "VAR_POP", desc: "Returns the population variance." },
  { name: "FIRST", desc: "Returns the first value (NULL or non-NULL) from arg. This function is affected by ordering." },
  { name: "LAST", desc: "Returns the last value of a column. This function is affected by ordering." },
  { name: "ANY_VALUE", desc: "Returns the first non-NULL value from arg. This function is affected by ordering." },
  { name: "COUNT_IF", desc: "Counts the total number of TRUE values for a boolean column." },
  { name: "BOOL_AND", desc: "Returns TRUE if every input value is TRUE, otherwise FALSE." },
  { name: "BOOL_OR", desc: "Returns TRUE if any input value is TRUE, otherwise FALSE." },
  { name: "LIST", desc: "Returns a LIST containing all the values of a column." },
  { name: "STRING_AGG", desc: "Concatenates the column string values with an optional separator." },
  { name: "ARG_MIN", desc: "Finds the row with the minimum val. Calculates the non-NULL arg expression at that row." },
  { name: "ARG_MAX", desc: "Finds the row with the maximum val. Calculates the non-NULL arg expression at that row." },
  { name: "QUANTILE_DISC", desc: "Returns the exact quantile number between 0 and 1." },
  { name: "QUANTILE_CONT", desc: "Returns the interpolated quantile number between 0 and 1." },
  { name: "APPROX_COUNT_DISTINCT", desc: "Computes the approximate count of distinct elements using HyperLogLog." },
  { name: "APPROX_QUANTILE", desc: "Computes the approximate quantile using T-Digest." },
  { name: "CORR", desc: "Returns the correlation coefficient for non-NULL pairs in a group." },
  { name: "COVAR_POP", desc: "Returns the population covariance of input values." },
  { name: "COVAR_SAMP", desc: "Returns the sample covariance for non-NULL pairs in a group." },
  { name: "REGR_SLOPE", desc: "Returns the slope of the linear regression line for non-NULL pairs in a group." },
  { name: "REGR_INTERCEPT", desc: "Returns the intercept of the univariate linear regression line for non-NULL pairs." },
  { name: "REGR_R2", desc: "Returns the coefficient of determination for non-NULL pairs in a group." },
  { name: "REGR_COUNT", desc: "Returns the number of non-NULL number pairs in a group." },
  { name: "REGR_AVGX", desc: "Returns the average of the independent variable for non-NULL pairs in a group." },
  { name: "REGR_AVGY", desc: "Returns the average of the dependent variable for non-NULL pairs in a group." },
  { name: "ENTROPY", desc: "Returns the log-2 entropy of count input-values." },
  { name: "KURTOSIS", desc: "Returns the excess kurtosis (Fisher's definition) of all input values, with bias correction." },
  { name: "SKEWNESS", desc: "Returns the skewness of all input values." },
  { name: "MAD", desc: "Returns the median absolute deviation for the values within x. NULL values are ignored." },
  { name: "SEM", desc: "Returns the standard error of the mean." },
  { name: "PRODUCT", desc: "Calculates the product of all tuples in arg." },
  { name: "BIT_AND", desc: "Returns the bitwise AND of all bits in a given expression." },
  { name: "BIT_OR", desc: "Returns the bitwise OR of all bits in a given expression." },
  { name: "BIT_XOR", desc: "Returns the bitwise XOR of all bits in a given expression." },
  { name: "BITSTRING_AGG", desc: "Returns a bitstring with bits set for each distinct value." },
  { name: "HISTOGRAM", desc: "Returns a LIST of STRUCTs with the fields bucket and count." },
  { name: "FSUM", desc: "Calculates the sum using a more accurate floating point summation (Kahan Sum)." },
  { name: "RESERVOIR_QUANTILE", desc: "Gives the approximate quantile using reservoir sampling, the sample size is optional and uses 8192 as a default size." },
];

/* ── Chart Types & Components ──────────────────────────────────── */
const CHART_PALETTE = ["#0777b3", "#bd4e35", "#2d7a00", "#e18727", "#638CAD", "#adadad", "#9b59b6", "#1abc9c", "#e74c3c", "#f39c12"];

const COLOR_THEMES: Record<string, { label: string; colors: string[] }> = {
  default: { label: 'Default', colors: ["#0777b3", "#bd4e35", "#2d7a00", "#e18727", "#638CAD", "#adadad", "#9b59b6", "#1abc9c", "#e74c3c", "#f39c12"] },
  ocean: { label: 'Ocean', colors: ["#0B3D91", "#1B6CB0", "#2196C8", "#4DB8DB", "#7DD4E8", "#A0E1F0", "#0E4D6F", "#1A7A9B", "#48A5C2", "#85C9DC"] },
  sunset: { label: 'Sunset', colors: ["#C62828", "#D84315", "#E65100", "#EF6C00", "#F57F17", "#FF8F00", "#FF6F00", "#E55B3C", "#D4451B", "#BF360C"] },
  forest: { label: 'Forest', colors: ["#1B5E20", "#2E7D32", "#388E3C", "#43A047", "#4CAF50", "#66BB6A", "#81C784", "#2C6B2F", "#3E8E41", "#5BA85E"] },
  pastel: { label: 'Pastel', colors: ["#90CAF9", "#F48FB1", "#A5D6A7", "#FFE082", "#CE93D8", "#80DEEA", "#FFAB91", "#B0BEC5", "#FFF59D", "#C5E1A5"] },
  monochrome: { label: 'Monochrome', colors: ["#212121", "#424242", "#616161", "#757575", "#9E9E9E", "#BDBDBD", "#E0E0E0", "#484848", "#6E6E6E", "#A3A3A3"] },
};

type ChartTypeId = 'table' | 'bar' | 'horizontal-bar' | 'stacked-bar' | 'stacked-horizontal-bar' | 'line' | 'stacked-line' | 'area' | 'stacked-area' | 'composed' | 'scatter' | 'pie' | 'big-number';

const CHART_TYPES: { id: ChartTypeId; label: string }[] = [
  { id: 'table', label: 'Pivot Table' },
  { id: 'bar', label: 'Bar' },
  { id: 'horizontal-bar', label: 'Horizontal Bar' },
  { id: 'stacked-bar', label: 'Stacked Bar' },
  { id: 'stacked-horizontal-bar', label: 'Stacked Horizontal Bar' },
  { id: 'line', label: 'Line' },
  { id: 'stacked-line', label: 'Stacked Line' },
  { id: 'area', label: 'Area' },
  { id: 'stacked-area', label: 'Stacked Area' },
  { id: 'composed', label: 'Multi-Type' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'pie', label: 'Pie' },
  { id: 'big-number', label: 'Big Number' },
];

const MINI_DATA = [
  { x: 'A', y1: 4, y2: 2.5 },
  { x: 'B', y1: 7, y2: 4 },
  { x: 'C', y1: 3, y2: 6 },
  { x: 'D', y1: 8, y2: 3 },
  { x: 'E', y1: 5, y2: 5 },
];

const MINI_PIE_DATA = [
  { name: 'A', value: 35 },
  { name: 'B', value: 25 },
  { name: 'C', value: 20 },
  { name: 'D', value: 20 },
];

function MiniChartPreview({ type }: { type: ChartTypeId }) {
  const c = CHART_PALETTE;
  const w = 90, h = 56;
  const m = { top: 2, right: 2, bottom: 2, left: 2 };
  const d = MINI_DATA;

  switch (type) {
    case 'table':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x="5" y="4" width={w - 10} height={h - 8} rx="3" fill="none" stroke={c[0]} strokeWidth="1.5" />
          <line x1="5" y1="16" x2={w - 5} y2="16" stroke={c[0]} strokeWidth="1" />
          <line x1="5" y1="26" x2={w - 5} y2="26" stroke="#e0e0e0" strokeWidth="0.5" />
          <line x1="5" y1="36" x2={w - 5} y2="36" stroke="#e0e0e0" strokeWidth="0.5" />
          <line x1="33" y1="4" x2="33" y2={h - 4} stroke="#e0e0e0" strokeWidth="0.5" />
          <line x1="60" y1="4" x2="60" y2={h - 4} stroke="#e0e0e0" strokeWidth="0.5" />
          <rect x="7" y="6" width="24" height="8" rx="1" fill="#e8f0f8" />
          <rect x="35" y="6" width="23" height="8" rx="1" fill="#e8f0f8" />
          <rect x="62" y="6" width="16" height="8" rx="1" fill="#e8f0f8" />
        </svg>
      );
    case 'bar':
      return (
        <ReBarChart width={w} height={h} data={d} margin={m} barGap={1} barSize={6}>
          <Bar dataKey="y1" fill={c[0]} radius={[1, 1, 0, 0]} />
          <Bar dataKey="y2" fill={c[1]} radius={[1, 1, 0, 0]} />
        </ReBarChart>
      );
    case 'horizontal-bar':
      return (
        <ReBarChart width={w} height={h} data={d} margin={m} barGap={1} barSize={6} layout="vertical">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="x" hide />
          <Bar dataKey="y1" fill={c[0]} radius={[0, 1, 1, 0]} />
          <Bar dataKey="y2" fill={c[1]} radius={[0, 1, 1, 0]} />
        </ReBarChart>
      );
    case 'stacked-bar':
      return (
        <ReBarChart width={w} height={h} data={d} margin={m} barSize={10}>
          <Bar dataKey="y1" fill={c[0]} stackId="s" />
          <Bar dataKey="y2" fill={c[1]} stackId="s" radius={[1, 1, 0, 0]} />
        </ReBarChart>
      );
    case 'stacked-horizontal-bar':
      return (
        <ReBarChart width={w} height={h} data={d} margin={m} barSize={10} layout="vertical">
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="x" hide />
          <Bar dataKey="y1" fill={c[0]} stackId="s" />
          <Bar dataKey="y2" fill={c[1]} stackId="s" radius={[0, 1, 1, 0]} />
        </ReBarChart>
      );
    case 'line':
      return (
        <ReLineChart width={w} height={h} data={d} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <Line type="linear" dataKey="y1" stroke={c[0]} strokeWidth={2} dot={false} />
          <Line type="linear" dataKey="y2" stroke={c[1]} strokeWidth={2} dot={false} />
        </ReLineChart>
      );
    case 'stacked-line':
      return (
        <ReAreaChart width={w} height={h} data={d} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <Area type="linear" dataKey="y1" fill="none" fillOpacity={0} stroke={c[0]} strokeWidth={2} stackId="s" dot={false} />
          <Area type="linear" dataKey="y2" fill="none" fillOpacity={0} stroke={c[1]} strokeWidth={2} stackId="s" dot={false} />
        </ReAreaChart>
      );
    case 'area':
      return (
        <ReAreaChart width={w} height={h} data={d} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <Area type="linear" dataKey="y1" fill={c[0]} fillOpacity={0.3} stroke={c[0]} strokeWidth={1.5} />
          <Area type="linear" dataKey="y2" fill={c[1]} fillOpacity={0.3} stroke={c[1]} strokeWidth={1.5} />
        </ReAreaChart>
      );
    case 'stacked-area':
      return (
        <ReAreaChart width={w} height={h} data={d} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <Area type="linear" dataKey="y1" fill={c[0]} fillOpacity={0.5} stroke={c[0]} strokeWidth={1} stackId="s" />
          <Area type="linear" dataKey="y2" fill={c[1]} fillOpacity={0.5} stroke={c[1]} strokeWidth={1} stackId="s" />
        </ReAreaChart>
      );
    case 'composed':
      return (
        <ReBarChart width={w} height={h} data={d} margin={m} barSize={8}>
          <Bar dataKey="y1" fill={c[0]} radius={[1, 1, 0, 0]} />
          <Line type="linear" dataKey="y2" stroke={c[1]} strokeWidth={2} dot={false} />
        </ReBarChart>
      );
    case 'scatter':
      return (
        <ReScatterChart width={w} height={h} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
          <XAxis type="number" dataKey="x" hide />
          <YAxis type="number" dataKey="y" hide />
          <Scatter data={[{ x: 1, y: 5 }, { x: 2, y: 3 }, { x: 3, y: 7 }, { x: 5, y: 4 }, { x: 7, y: 6 }]} fill={c[0]} />
        </ReScatterChart>
      );
    case 'pie':
      return (
        <RePieChart width={w} height={h}>
          <Pie data={MINI_PIE_DATA} dataKey="value" cx="50%" cy="50%" outerRadius={22} innerRadius={0} strokeWidth={1}>
            {MINI_PIE_DATA.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
          </Pie>
        </RePieChart>
      );
    case 'big-number':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <text x={w/2} y={h/2 + 8} textAnchor="middle" fill={c[0]} fontSize="28" fontWeight="bold">42</text>
        </svg>
      );
    default:
      return null;
  }
}

function ChartTypePicker({
  activeType,
  onSelect,
}: {
  activeType: ChartTypeId;
  onSelect: (type: ChartTypeId) => void;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: 16,
      padding: 24,
      justifyItems: 'center',
    }}>
      {CHART_TYPES.map(({ id, label }) => (
        <div
          key={id}
          onClick={() => onSelect(id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: 16,
            borderRadius: 12,
            cursor: 'pointer',
            border: activeType === id ? '2px solid #0777b3' : '2px solid transparent',
            background: activeType === id ? '#f0f7fc' : '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            transition: 'all 0.15s ease',
            width: 130,
          }}
          onMouseEnter={(e) => {
            if (activeType !== id) {
              e.currentTarget.style.background = '#f8fafe';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            if (activeType !== id) {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
            }
          }}
        >
          <div style={{
            background: '#fafafa',
            borderRadius: 8,
            padding: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MiniChartPreview type={id} />
          </div>
          <span style={{
            fontSize: 12,
            fontWeight: activeType === id ? 600 : 500,
            color: activeType === id ? '#0777b3' : '#231f20',
            textAlign: 'center',
          }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatBigNumber(value: number, abbreviate: boolean, decimalPlaces: number): string {
  if (!isFinite(value)) return String(value);
  if (!abbreviate) {
    const fixed = decimalPlaces != null ? value.toFixed(decimalPlaces) : String(value);
    // Add comma separators
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }
  const absVal = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absVal >= 1e15) return sign + (absVal / 1e15).toFixed(decimalPlaces) + 'Q';
  if (absVal >= 1e12) return sign + (absVal / 1e12).toFixed(decimalPlaces) + 'T';
  if (absVal >= 1e9) return sign + (absVal / 1e9).toFixed(decimalPlaces) + 'B';
  if (absVal >= 1e6) return sign + (absVal / 1e6).toFixed(decimalPlaces) + 'M';
  if (absVal >= 1e3) return sign + (absVal / 1e3).toFixed(decimalPlaces) + 'K';
  return sign + absVal.toFixed(decimalPlaces);
}

function PivotChart({
  chartType,
  data,
  allColumns,
  rowCols,
  chartTitle,
  chartTitleFontSize,
  chartTitlePosition,
  dataLabelsEnabled,
  dataLabelsPosition,
  dataLabelsFontSize,
  dataLabelsColor,
  dataLabelsBgColor,
  dataLabelsBold,
  dataLabelsItalic,
  legendEnabled,
  legendPosition,
  legendFontSize,
  legendSortOrder,
  sortedSeriesOrder,
  colorTheme,
  markersEnabled,
  markerSize,
  markerShapeTheme,
  markerFill,
  chartLineWidth,
  showLines,
  seriesOverrides,
  composedDefaultType,
  composedStacked,
  chartBarGap,
  chartBarCategoryGap,
  xAxisMin,
  xAxisMax,
  yAxisMin,
  yAxisMax,
}: {
  chartType: ChartTypeId;
  data: Record<string, unknown>[];
  allColumns: string[];
  rowCols: string[];
  chartTitle?: string;
  chartTitleFontSize?: number;
  chartTitlePosition?: 'left' | 'center' | 'right';
  dataLabelsEnabled?: boolean;
  dataLabelsPosition?: 'above' | 'on' | 'below';
  dataLabelsFontSize?: number;
  dataLabelsColor?: string;
  dataLabelsBgColor?: string;
  dataLabelsBold?: boolean;
  dataLabelsItalic?: boolean;
  legendEnabled?: boolean;
  legendPosition?: 'bottom' | 'left' | 'right' | 'top';
  legendFontSize?: number;
  legendSortOrder?: 'a-z' | 'z-a' | 'biggest-smallest' | 'smallest-biggest';
  sortedSeriesOrder?: string[];
  colorTheme?: string;
  markersEnabled?: boolean;
  markerSize?: number;
  markerShapeTheme?: 'circles' | 'triangles' | 'squares' | 'diamonds' | 'mixed';
  markerFill?: 'solid' | 'border';
  chartLineWidth?: number;
  showLines?: boolean;
  seriesOverrides?: Record<string, { color?: string; lineWidth?: number; barWidth?: number; areaOpacity?: number; seriesChartType?: 'bar' | 'line' | 'area'; showLines?: boolean; markersEnabled?: boolean; markerSize?: number; markerShapeTheme?: 'circles' | 'triangles' | 'squares' | 'diamonds' | 'mixed'; markerFill?: 'solid' | 'border' }>;
  composedDefaultType?: 'bar' | 'line' | 'area';
  composedStacked?: boolean;
  chartBarGap?: number;
  chartBarCategoryGap?: number;
  xAxisMin?: string;
  xAxisMax?: string;
  yAxisMin?: string;
  yAxisMax?: string;
}) {
  // Original (unsorted) series columns — used for stable color assignment
  const unsortedSeriesCols = useMemo(() => {
    return allColumns.filter(c => !rowCols.includes(c) && c !== 'value_names');
  }, [allColumns, rowCols]);

  const seriesCols = useMemo(() => {
    const base = unsortedSeriesCols;
    if (sortedSeriesOrder && sortedSeriesOrder.length > 0) {
      const baseSet = new Set(base);
      const sorted = sortedSeriesOrder.filter(c => baseSet.has(c));
      for (const c of base) { if (!sorted.includes(c)) sorted.push(c); }
      return sorted;
    }
    // Fallback: compute from data when sortedSeriesOrder is not provided (e.g. dashboard)
    if (legendSortOrder === 'a-z') return [...base].sort((a, b) => a.localeCompare(b));
    if (legendSortOrder === 'z-a') return [...base].sort((a, b) => b.localeCompare(a));
    if (legendSortOrder === 'biggest-smallest' || legendSortOrder === 'smallest-biggest') {
      const totals: Record<string, number> = {};
      for (const col of base) totals[col] = data.reduce((sum, row) => sum + N(row[col]), 0);
      const sorted = [...base].sort((a, b) => totals[b] - totals[a]);
      return legendSortOrder === 'smallest-biggest' ? sorted.reverse() : sorted;
    }
    return base;
  }, [unsortedSeriesCols, sortedSeriesOrder, legendSortOrder, data]);

  // Stable color index: always based on original column order, not sorted order
  const stableColorIndex = useMemo(() => {
    const map: Record<string, number> = {};
    unsortedSeriesCols.forEach((col, i) => { map[col] = i; });
    return map;
  }, [unsortedSeriesCols]);

  // Key to force recharts remount when series order changes
  const seriesOrderKey = useMemo(() => seriesCols.join('|'), [seriesCols]);

  const xKey = rowCols.length === 1 ? rowCols[0] : '__x__';

  const chartData = useMemo(() => {
    return data.map((row, idx) => {
      const entry: Record<string, any> = {};
      if (rowCols.length === 1) {
        entry[rowCols[0]] = String(row[rowCols[0]] ?? '');
      } else if (rowCols.length > 1) {
        entry.__x__ = rowCols.map(r => String(row[r] ?? '')).join(' | ');
      } else {
        entry.__x__ = String(idx);
      }
      for (const col of seriesCols) {
        entry[col] = N(row[col]);
      }
      return entry;
    });
  }, [data, rowCols, seriesCols]);

  // ── Legend filtering state ──────────────────────────────────────
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [soloSeries, setSoloSeries] = useState<string | null>(null);
  const [hoveredIndicator, setHoveredIndicator] = useState<string | null>(null);
  const [legendLimit, setLegendLimit] = useState(25);

  // Compute visible series based on hidden state only
  // (solo clicks update hiddenSeries directly, so this is the single source of truth)
  const visibleSeries = useMemo(() => {
    return seriesCols.filter(c => !hiddenSeries.has(c));
  }, [seriesCols, hiddenSeries]);

  // ── Zoom state ──────────────────────────────────────────────────
  // Category charts (bar/line/area): zoom by slicing chartData indices
  const [zoomLeft, setZoomLeft] = useState<number | null>(null);   // start index
  const [zoomRight, setZoomRight] = useState<number | null>(null); // end index (inclusive)
  // Scatter charts: zoom by numeric domain
  const [scatterDomain, setScatterDomain] = useState<{ x: [number, number]; y: [number, number] } | null>(null);
  // Drag selection state
  const [refAreaLeft, setRefAreaLeft] = useState<string | number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | number | null>(null);
  const isDragging = useRef(false);

  // Reset zoom and legend filters when data or chart type changes
  useEffect(() => {
    setZoomLeft(null);
    setZoomRight(null);
    setScatterDomain(null);
    setRefAreaLeft(null);
    setRefAreaRight(null);
    isDragging.current = false;
    setHiddenSeries(new Set());
    setSoloSeries(null);
    setHoveredIndicator(null);
    setLegendLimit(25);
  }, [chartType, data, rowCols]);

  // Compute displayed data for category charts
  const displayData = useMemo(() => {
    let data = chartData;
    if (zoomLeft != null && zoomRight != null) {
      const lo = Math.min(zoomLeft, zoomRight);
      const hi = Math.max(zoomLeft, zoomRight);
      data = data.slice(lo, hi + 1);
    }
    // Apply X axis min/max for category charts by filtering data points
    const xMin = xAxisMin != null && xAxisMin !== '' ? Number(xAxisMin) : NaN;
    const xMax = xAxisMax != null && xAxisMax !== '' ? Number(xAxisMax) : NaN;
    if (!isNaN(xMin) || !isNaN(xMax)) {
      data = data.filter(row => {
        const v = Number(row[xKey]);
        if (isNaN(v)) return true; // keep non-numeric values
        if (!isNaN(xMin) && v < xMin) return false;
        if (!isNaN(xMax) && v > xMax) return false;
        return true;
      });
    }
    return data;
  }, [chartData, zoomLeft, zoomRight, xAxisMin, xAxisMax, xKey]);

  const xInterval = displayData.length > 30 ? Math.ceil(displayData.length / 20) : 0;
  const margin = { top: 5, right: 10, bottom: 5, left: 10 };

  // ── Format helpers ──────────────────────────────────────────────
  const palette = useMemo(() => {
    if (colorTheme && colorTheme !== 'default' && COLOR_THEMES[colorTheme]) {
      return COLOR_THEMES[colorTheme].colors;
    }
    return CHART_PALETTE;
  }, [colorTheme]);

  const titleEl = chartTitle ? (
    <div style={{
      textAlign: chartTitlePosition || 'center',
      fontSize: chartTitleFontSize || 16,
      fontWeight: 600,
      color: '#231f20',
      padding: '0 0 2px',
      flexShrink: 0,
    }}>
      {chartTitle}
    </div>
  ) : null;

  const labelProps = useMemo(() => {
    if (!dataLabelsEnabled) return {};
    return {
      label: {
        position: dataLabelsPosition === 'above' ? 'top' : dataLabelsPosition === 'below' ? 'bottom' : 'center',
        fontSize: dataLabelsFontSize || 11,
        fill: dataLabelsColor || '#231f20',
        fontWeight: dataLabelsBold ? 600 : 400,
        fontStyle: dataLabelsItalic ? 'italic' : 'normal',
      }
    };
  }, [dataLabelsEnabled, dataLabelsPosition, dataLabelsFontSize, dataLabelsColor, dataLabelsBold, dataLabelsItalic]);

  const shapeNames = ['circle', 'triangle', 'square', 'diamond'] as const;
  const getShapeForSeries = useCallback((idx: number): string => {
    if (markerShapeTheme === 'mixed') return shapeNames[idx % shapeNames.length];
    const map: Record<string, string> = { circles: 'circle', triangles: 'triangle', squares: 'square', diamonds: 'diamond' };
    return map[markerShapeTheme || 'circles'] || 'circle';
  }, [markerShapeTheme]);

  const renderDotShape = useCallback((shape: string, cx: number, cy: number, r: number, fill: string, stroke: string, isBorder: boolean) => {
    const f = isBorder ? 'none' : fill;
    const s = isBorder ? stroke : stroke;
    const sw = isBorder ? 2 : 0;
    switch (shape) {
      case 'triangle': {
        const h = r * 1.8;
        const pts = `${cx},${cy - h * 0.6} ${cx - h * 0.5},${cy + h * 0.4} ${cx + h * 0.5},${cy + h * 0.4}`;
        return <polygon points={pts} fill={f} stroke={s} strokeWidth={sw} />;
      }
      case 'square': {
        const side = r * 1.5;
        return <rect x={cx - side / 2} y={cy - side / 2} width={side} height={side} fill={f} stroke={s} strokeWidth={sw} />;
      }
      case 'diamond': {
        const d = r * 1.6;
        const pts = `${cx},${cy - d / 2} ${cx + d / 2},${cy} ${cx},${cy + d / 2} ${cx - d / 2},${cy}`;
        return <polygon points={pts} fill={f} stroke={s} strokeWidth={sw} />;
      }
      default: // circle
        return <circle cx={cx} cy={cy} r={r} fill={f} stroke={s} strokeWidth={sw} />;
    }
  }, []);

  const getMarkerDot = useCallback((seriesIdx: number, seriesColor: string) => {
    if (markersEnabled === false) return { dot: false, activeDot: { r: 4 } };
    const r = markerSize || 4;
    const shape = getShapeForSeries(seriesIdx);
    const isBorder = markerFill === 'border';
    const dotRenderer = (props: any) => {
      const { cx, cy, stroke: st, key } = props;
      if (cx == null || cy == null) return null;
      return <svg key={key}>{renderDotShape(shape, cx, cy, r, seriesColor, st || seriesColor, isBorder)}</svg>;
    };
    return { dot: dotRenderer };
  }, [markersEnabled, markerSize, getShapeForSeries, markerFill, renderDotShape]);

  const yDomain = useMemo(() => {
    const min = yAxisMin != null && yAxisMin !== '' ? Number(yAxisMin) : undefined;
    const max = yAxisMax != null && yAxisMax !== '' ? Number(yAxisMax) : undefined;
    if (min != null && !isNaN(min) && max != null && !isNaN(max)) return [min, max];
    if (min != null && !isNaN(min)) return [min, 'auto' as const];
    if (max != null && !isNaN(max)) return ['auto' as const, max];
    return undefined;
  }, [yAxisMin, yAxisMax]);

  const xDomainNumeric = useMemo(() => {
    const min = xAxisMin != null && xAxisMin !== '' ? Number(xAxisMin) : undefined;
    const max = xAxisMax != null && xAxisMax !== '' ? Number(xAxisMax) : undefined;
    if (min != null && !isNaN(min) && max != null && !isNaN(max)) return [min, max];
    if (min != null && !isNaN(min)) return [min, 'auto' as const];
    if (max != null && !isNaN(max)) return ['auto' as const, max];
    return undefined;
  }, [xAxisMin, xAxisMax]);

  const getSeriesColor = useCallback((col: string, _idx: number) => {
    if (seriesOverrides?.[col]?.color) return seriesOverrides[col].color!;
    const stableIdx = stableColorIndex[col] ?? _idx;
    return palette[stableIdx % palette.length];
  }, [seriesOverrides, palette, stableColorIndex]);

  // ── Category chart zoom handlers ──────────────────────────────
  const catMouseDown = useCallback((e: any) => {
    if (!e || !e.activeLabel) return;
    isDragging.current = true;
    setRefAreaLeft(e.activeLabel);
    setRefAreaRight(e.activeLabel);
  }, []);

  const catMouseMove = useCallback((e: any) => {
    if (!isDragging.current || !e || !e.activeLabel) return;
    setRefAreaRight(e.activeLabel);
  }, []);

  const catMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (refAreaLeft == null || refAreaRight == null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    // Find indices in chartData (not displayData) that match the labels
    const baseData = (zoomLeft != null && zoomRight != null)
      ? chartData.slice(Math.min(zoomLeft, zoomRight), Math.max(zoomLeft, zoomRight) + 1)
      : chartData;
    let idxL = baseData.findIndex(d => d[xKey] === refAreaLeft);
    let idxR = baseData.findIndex(d => d[xKey] === refAreaRight);
    if (idxL === -1 || idxR === -1 || idxL === idxR) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    if (idxL > idxR) [idxL, idxR] = [idxR, idxL];
    // Convert back to absolute chartData indices
    const offset = (zoomLeft != null && zoomRight != null) ? Math.min(zoomLeft, zoomRight) : 0;
    setZoomLeft(offset + idxL);
    setZoomRight(offset + idxR);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight, chartData, xKey, zoomLeft, zoomRight]);

  const catDoubleClick = useCallback(() => {
    if (zoomLeft != null || zoomRight != null) {
      // Already zoomed: reset to default
      setZoomLeft(null);
      setZoomRight(null);
    }
    // If already at default, no further zoom-out for category charts (data is discrete)
  }, [zoomLeft, zoomRight]);

  // ── Scatter chart zoom handlers ──────────────────────────────
  const scatterMouseDown = useCallback((e: any) => {
    if (!e) return;
    const val = e.xValue ?? e.chartX;
    if (val == null) return;
    isDragging.current = true;
    setRefAreaLeft(val);
    setRefAreaRight(val);
  }, []);

  const scatterMouseMove = useCallback((e: any) => {
    if (!isDragging.current || !e) return;
    const val = e.xValue ?? e.chartX;
    if (val == null) return;
    setRefAreaRight(val);
  }, []);

  const scatterMouseUp = useCallback((scatterData: { x: number; y: number }[]) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (refAreaLeft == null || refAreaRight == null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const left = Number(refAreaLeft);
    const right = Number(refAreaRight);
    const xMin = Math.min(left, right);
    const xMax = Math.max(left, right);
    // Find Y range for points within the X selection
    const pointsInRange = scatterData.filter(p => p.x >= xMin && p.x <= xMax);
    if (pointsInRange.length === 0) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    const yVals = pointsInRange.map(p => p.y);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);
    const yPad = (yMax - yMin) * 0.05 || 1;
    setScatterDomain({ x: [xMin, xMax], y: [yMin - yPad, yMax + yPad] });
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight]);

  const scatterDoubleClick = useCallback((scatterData: { x: number; y: number }[]) => {
    if (scatterDomain != null) {
      // Already zoomed: reset to default
      setScatterDomain(null);
    } else {
      // At default: zoom out 2x
      const xs = scatterData.map(p => p.x);
      const ys = scatterData.map(p => p.y);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      const xRange = (xMax - xMin) || 1;
      const yRange = (yMax - yMin) || 1;
      setScatterDomain({
        x: [xMin - xRange * 0.5, xMax + xRange * 0.5],
        y: [yMin - yRange * 0.5, yMax + yRange * 0.5],
      });
    }
  }, [scatterDomain]);

  const renderTooltip = useCallback((props: any) => {
    const { active, payload, label } = props;
    if (!active || !payload) return null;
    const items = payload.filter((p: any) => p.value !== 0 && p.value != null);
    if (items.length === 0) return null;
    return (
      <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 4, padding: '4px 8px', fontSize: 11, lineHeight: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
        {items.map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1px 0' }}>
            <span style={{ width: 8, height: 8, borderRadius: 1, background: item.color, flexShrink: 0 }} />
            <span style={{ color: '#6a6a6a' }}>{item.name}:</span>
            <span style={{ fontWeight: 500 }}>{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</span>
          </div>
        ))}
      </div>
    );
  }, []);

  const renderLegend = useCallback((props: any) => {
    const { payload } = props;
    if (!payload || payload.length === 0) return null;
    const shown = payload.slice(0, legendLimit);
    const extra = payload.length - legendLimit;
    const isVertical = legendPosition === 'left' || legendPosition === 'right';
    return (
      <div style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        flexWrap: isVertical ? 'nowrap' : 'wrap',
        justifyContent: isVertical ? 'flex-start' : 'center',
        gap: isVertical ? '4px 8px' : '4px 12px',
        maxHeight: isVertical ? '100%' : (legendLimit > 25 ? 200 : 84),
        maxWidth: isVertical ? 160 : undefined,
        overflow: 'auto',
        padding: isVertical ? '0 8px' : '0',
      }}>
        {shown.map((entry: any, i: number) => {
          const seriesName = entry.value;
          const isVisible = !hiddenSeries.has(seriesName);
          const isSolo = soloSeries === seriesName;
          const isHovered = hoveredIndicator === seriesName;
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: legendFontSize || 13, color: '#231f20', whiteSpace: 'nowrap', userSelect: 'none' }}>
              {/* Color indicator - click to toggle visibility */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setHiddenSeries(prev => {
                    const next = new Set(prev);
                    if (next.has(seriesName)) {
                      next.delete(seriesName);
                    } else {
                      next.add(seriesName);
                    }
                    return next;
                  });
                }}
                onMouseEnter={() => setHoveredIndicator(seriesName)}
                onMouseLeave={() => setHoveredIndicator(null)}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: isVisible ? entry.color : 'transparent',
                  border: `2px solid ${entry.color}`,
                  flexShrink: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  position: 'relative' as const,
                }}
              >
                {isHovered && isVisible && (
                  <span style={{ fontSize: 10, fontWeight: 700, lineHeight: 1, color: '#fff', position: 'absolute' as const }}>✕</span>
                )}
                {isHovered && !isVisible && (
                  <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1, color: entry.color, position: 'absolute' as const }}>✓</span>
                )}
              </span>
              {/* Name text - click to solo/unsolo */}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  if (soloSeries === seriesName) {
                    // Unsolo: show everything
                    setSoloSeries(null);
                    setHiddenSeries(new Set());
                  } else {
                    // Solo: hide all except this one (use full payload, not just displayed items)
                    setSoloSeries(seriesName);
                    const allNames = payload.map((p: any) => p.value);
                    setHiddenSeries(new Set(allNames.filter((n: any) => n !== seriesName)));
                  }
                }}
                style={{
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer',
                  fontWeight: isSolo ? 700 : 400,
                  opacity: isVisible ? 1 : 0.4,
                }}
                title={seriesName}
              >
                {seriesName}
              </span>
            </span>
          );
        })}
        {extra > 0 && (
          <span
            onClick={(e: any) => { e.stopPropagation(); setLegendLimit((l: number) => l + 25); }}
            onMouseEnter={(e: any) => { e.currentTarget.dataset.orig = e.currentTarget.textContent; e.currentTarget.textContent = `show ${Math.min(25, extra)} more`; }}
            onMouseLeave={(e: any) => { e.currentTarget.textContent = e.currentTarget.dataset.orig; }}
            style={{ fontSize: legendFontSize || 13, color: '#0777b3', fontStyle: 'italic', cursor: 'pointer', userSelect: 'none' }}
          >+{extra} more</span>
        )}
      </div>
    );
  }, [hiddenSeries, soloSeries, hoveredIndicator, legendLimit, legendPosition, legendFontSize]);

  // Build legend payload from seriesCols and render outside recharts to avoid measurement loops
  const legendPayload = useMemo(() => {
    return seriesCols.map((col, i) => ({ value: col, color: getSeriesColor(col, i) }));
  }, [seriesCols, getSeriesColor]);

  const legendElement = useMemo(() => {
    if (legendEnabled === false) return null;
    return renderLegend({ payload: legendPayload });
  }, [legendEnabled, renderLegend, legendPayload]);

  // Wrapper that renders title + legend outside recharts + ResponsiveContainer
  const pos = legendPosition || 'bottom';
  const isLegendVertical = pos === 'left' || pos === 'right';
  const chartWrap = (chart: React.ReactNode, customLegend?: React.ReactNode) => {
    const leg = customLegend !== undefined ? customLegend : legendElement;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
        {titleEl}
        {pos === 'top' && leg}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, ...(isLegendVertical ? {} : { flexDirection: 'column' }) }}>
          {pos === 'left' && <div style={{ flexShrink: 0, overflow: 'auto', maxWidth: 160, paddingRight: 8 }}>{leg}</div>}
          <ResponsiveContainer width="100%" height="100%" debounce={150}>
            {chart as any}
          </ResponsiveContainer>
          {pos === 'right' && <div style={{ flexShrink: 0, overflow: 'auto', maxWidth: 160, paddingLeft: 8 }}>{leg}</div>}
        </div>
        {pos === 'bottom' && leg}
      </div>
    );
  };

  if (seriesCols.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#adadad', fontSize: 14, textAlign: 'center', padding: 40 }}>
        Add columns to the Values quadrant to see chart data
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#adadad', fontSize: 14 }}>
        No data to chart
      </div>
    );
  }

  if (chartType === 'bar' || chartType === 'stacked-bar') {
    return chartWrap(
          <ReBarChart
            key={seriesOrderKey}
            data={displayData}
            margin={margin}
            barGap={`${chartBarGap ?? 4}%`} barCategoryGap={`${chartBarCategoryGap ?? 20}%`}
            onMouseDown={catMouseDown}
            onMouseMove={catMouseMove}
            onMouseUp={catMouseUp}
            onDoubleClick={catDoubleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={xKey} fontSize={11} angle={-45} textAnchor="end" interval={xInterval} height={50} allowDataOverflow={zoomLeft != null} />
            <YAxis fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} {...(yDomain ? { domain: yDomain, allowDataOverflow: true } : {})} />
            <ReTooltip content={renderTooltip} />
            {seriesCols.map((col, i) => (
              <Bar
                key={col}
                dataKey={col}
                fill={getSeriesColor(col, i)}
                stackId={chartType === 'stacked-bar' ? 'stack' : undefined}
                hide={!visibleSeries.includes(col)}
                {...labelProps}
              />
            ))}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} {...{fill: "#8884d8", fillOpacity: 0.2} as any} />
            )}
          </ReBarChart>
    );
  }

  if (chartType === 'horizontal-bar' || chartType === 'stacked-horizontal-bar') {
    return chartWrap(
          <ReBarChart
            key={seriesOrderKey}
            layout="vertical"
            data={displayData}
            margin={margin}
            barGap={`${chartBarGap ?? 4}%`} barCategoryGap={`${chartBarCategoryGap ?? 20}%`}
            onMouseDown={catMouseDown}
            onMouseMove={catMouseMove}
            onMouseUp={catMouseUp}
            onDoubleClick={catDoubleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis type="number" fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} {...(yDomain ? { domain: yDomain, allowDataOverflow: true } : {})} />
            <YAxis type="category" dataKey={xKey} fontSize={11} width={120} />
            <ReTooltip content={renderTooltip} />
            {seriesCols.map((col, i) => (
              <Bar
                key={col}
                dataKey={col}
                fill={getSeriesColor(col, i)}
                stackId={chartType === 'stacked-horizontal-bar' ? 'stack' : undefined}
                hide={!visibleSeries.includes(col)}
                {...labelProps}
              />
            ))}
          </ReBarChart>
    );
  }

  if (chartType === 'line') {
    return chartWrap(
          <ReLineChart
            key={seriesOrderKey}
            data={displayData}
            margin={margin}
            onMouseDown={catMouseDown}
            onMouseMove={catMouseMove}
            onMouseUp={catMouseUp}
            onDoubleClick={catDoubleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={xKey} fontSize={11} angle={-45} textAnchor="end" interval={xInterval} height={50} allowDataOverflow={zoomLeft != null} />
            <YAxis fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} {...(yDomain ? { domain: yDomain, allowDataOverflow: true } : {})} />
            <ReTooltip content={renderTooltip} />
            {seriesCols.map((col, i) => {
              const color = getSeriesColor(col, i);
              const so = seriesOverrides?.[col];
              const sShowLines = so?.showLines ?? showLines;
              const getSODot = () => {
                const mEnabled = so?.markersEnabled ?? markersEnabled;
                if (mEnabled === false) return { dot: false, activeDot: { r: 4 } };
                const r = so?.markerSize ?? markerSize ?? 4;
                const sTheme = so?.markerShapeTheme ?? markerShapeTheme;
                const sFill = so?.markerFill ?? markerFill;
                const shape = sTheme === 'mixed' ? shapeNames[i % shapeNames.length] : ({ circles: 'circle', triangles: 'triangle', squares: 'square', diamonds: 'diamond' }[sTheme || 'circles'] || 'circle');
                const isBorder = sFill === 'border';
                const dotRenderer = (props: any) => {
                  const { cx, cy, stroke: st, key } = props;
                  if (cx == null || cy == null) return null;
                  return <svg key={key}>{renderDotShape(shape, cx, cy, r, color, st || color, isBorder)}</svg>;
                };
                return { dot: dotRenderer };
              };
              return (
              <Line
                key={col}
                type="linear"
                dataKey={col}
                stroke={color}
                strokeWidth={sShowLines === false ? 0 : (so?.lineWidth || chartLineWidth || 2)}
                {...getSODot()}
                hide={!visibleSeries.includes(col)}
                {...labelProps}
              />
              );
            })}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} {...{fill: "#8884d8", fillOpacity: 0.2} as any} />
            )}
          </ReLineChart>
    );
  }

  if (chartType === 'area' || chartType === 'stacked-area' || chartType === 'stacked-line') {
    const isStacked = chartType === 'stacked-area' || chartType === 'stacked-line';
    const isStackedLine = chartType === 'stacked-line';
    return chartWrap(
          <ReAreaChart
            key={seriesOrderKey}
            data={displayData}
            margin={margin}
            onMouseDown={catMouseDown}
            onMouseMove={catMouseMove}
            onMouseUp={catMouseUp}
            onDoubleClick={catDoubleClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={xKey} fontSize={11} angle={-45} textAnchor="end" interval={xInterval} height={50} allowDataOverflow={zoomLeft != null} />
            <YAxis fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} {...(yDomain ? { domain: yDomain, allowDataOverflow: true } : {})} />
            <ReTooltip content={renderTooltip} />
            {seriesCols.map((col, i) => {
              const areaColor = getSeriesColor(col, i);
              const so = seriesOverrides?.[col];
              const overrideOpacity = so?.areaOpacity;
              const defaultOpacity = isStackedLine ? 0 : (chartType === 'stacked-area' ? 0.6 : 0.3);
              const sShowLines = so?.showLines ?? showLines;
              const getSODot = () => {
                const mEnabled = so?.markersEnabled ?? markersEnabled;
                if (mEnabled === false) return { dot: false, activeDot: { r: 4 } };
                const r = so?.markerSize ?? markerSize ?? 4;
                const sTheme = so?.markerShapeTheme ?? markerShapeTheme;
                const sFill = so?.markerFill ?? markerFill;
                const shape = sTheme === 'mixed' ? shapeNames[i % shapeNames.length] : ({ circles: 'circle', triangles: 'triangle', squares: 'square', diamonds: 'diamond' }[sTheme || 'circles'] || 'circle');
                const isBorder = sFill === 'border';
                const dotRenderer = (props: any) => {
                  const { cx, cy, stroke: st, key } = props;
                  if (cx == null || cy == null) return null;
                  return <svg key={key}>{renderDotShape(shape, cx, cy, r, areaColor, st || areaColor, isBorder)}</svg>;
                };
                return { dot: dotRenderer };
              };
              return (
                <Area
                  key={col}
                  type="linear"
                  dataKey={col}
                  fill={isStackedLine ? 'none' : areaColor}
                  fillOpacity={isStackedLine ? 0 : (overrideOpacity != null ? overrideOpacity : defaultOpacity)}
                  stroke={areaColor}
                  strokeWidth={sShowLines === false ? 0 : (so?.lineWidth || chartLineWidth || 2)}
                  stackId={isStacked ? 'stack' : undefined}
                  hide={!visibleSeries.includes(col)}
                  {...getSODot()}
                  {...labelProps}
                />
              );
            })}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} {...{fill: "#8884d8", fillOpacity: 0.2} as any} />
            )}
          </ReAreaChart>
    );
  }

  if (chartType === 'composed') {
    // Build children array first, then pick the right container
    const composedChildren: React.ReactNode[] = [
      <CartesianGrid key="__grid" strokeDasharray="3 3" stroke="#eee" />,
      <XAxis key="__x" dataKey={xKey} fontSize={11} angle={-45} textAnchor="end" interval={xInterval} height={50} allowDataOverflow={zoomLeft != null} />,
      <YAxis key="__y" fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} {...(yDomain ? { domain: yDomain, allowDataOverflow: true } : {})} />,
      <ReTooltip key="__tip" content={renderTooltip} />,
    ];
    // Legend rendered outside recharts via chartWrap

    let hasBar = false;
    let hasArea = false;
    for (const col of seriesCols) {
      const so = seriesOverrides?.[col];
      const sType = so?.seriesChartType || composedDefaultType || 'line';
      const color = getSeriesColor(col, seriesCols.indexOf(col));
      const hidden = !visibleSeries.includes(col);
      const seriesShowLines = so?.showLines ?? showLines;
      const idx = seriesCols.indexOf(col);
      const getSeriesDot = () => {
        const mEnabled = so?.markersEnabled ?? markersEnabled;
        if (mEnabled === false) return { dot: false, activeDot: { r: 4 } };
        const r = so?.markerSize ?? markerSize ?? 4;
        const sTheme = so?.markerShapeTheme ?? markerShapeTheme;
        const sFill = so?.markerFill ?? markerFill;
        const shape = sTheme === 'mixed' ? shapeNames[idx % shapeNames.length] : ({ circles: 'circle', triangles: 'triangle', squares: 'square', diamonds: 'diamond' }[sTheme || 'circles'] || 'circle');
        const isBorder = sFill === 'border';
        const dotRenderer = (props: any) => {
          const { cx, cy, stroke: st, key } = props;
          if (cx == null || cy == null) return null;
          return <svg key={key}>{renderDotShape(shape, cx, cy, r, color, st || color, isBorder)}</svg>;
        };
        return { dot: dotRenderer };
      };
      const stackId = composedStacked ? 'stack' : undefined;
      if (sType === 'line') {
        composedChildren.push(<Line key={col} type="linear" dataKey={col} stroke={color}
          strokeWidth={seriesShowLines === false ? 0 : (so?.lineWidth || chartLineWidth || 2)}
          {...getSeriesDot()} hide={hidden} {...labelProps} />);
      } else if (sType === 'area') {
        hasArea = true;
        const opacity = so?.areaOpacity ?? 0.3;
        composedChildren.push(<Area key={col} type="linear" dataKey={col} fill={color} fillOpacity={opacity}
          stroke={color} strokeWidth={seriesShowLines === false ? 0 : (so?.lineWidth || chartLineWidth || 2)}
          stackId={stackId}
          {...getSeriesDot()} hide={hidden} {...labelProps} />);
      } else {
        hasBar = true;
        composedChildren.push(<Bar key={col} dataKey={col} fill={color} hide={hidden}
          stackId={stackId}
          {...labelProps} />);
      }
    }
    if (refAreaLeft && refAreaRight) {
      composedChildren.push(<ReferenceArea key="__ref" x1={refAreaLeft} x2={refAreaRight} {...{fill: "#8884d8", fillOpacity: 0.2} as any} />);
    }

    const chartProps = {
      data: displayData,
      margin,
      onMouseDown: catMouseDown,
      onMouseMove: catMouseMove,
      onMouseUp: catMouseUp,
      onDoubleClick: catDoubleClick,
    };
    // AreaChart supports Area+Line; BarChart supports Bar+Line; pick based on what's present
    // If both bars and areas exist, prefer BarChart and render areas as Lines with fill workaround
    // In practice: use AreaChart when areas exist (it handles Line children), BarChart otherwise
    const ChartContainer = hasArea && !hasBar ? ReAreaChart : ReBarChart;
    const extraProps = ChartContainer === ReBarChart
      ? { barGap: `${chartBarGap ?? 4}%`, barCategoryGap: `${chartBarCategoryGap ?? 20}%` }
      : {};

    return chartWrap(
          <ChartContainer key={seriesOrderKey} {...chartProps} {...extraProps}>
            {composedChildren}
          </ChartContainer>
    );
  }

  if (chartType === 'scatter') {
    const xCol = seriesCols[0];
    const yCol = seriesCols.length > 1 ? seriesCols[1] : seriesCols[0];
    const scatterName = `${xCol} vs ${yCol}`;
    const scatterData = data.map(row => ({
      x: N(row[xCol]),
      y: N(row[yCol]),
      name: rowCols.map(r => String(row[r] ?? '')).join(' | '),
    }));
    const scatterVisible = visibleSeries.includes(scatterName) || visibleSeries.some(s => s === xCol || s === yCol) || (soloSeries == null && !hiddenSeries.has(scatterName));
    const filteredScatterData = scatterVisible ? scatterData : [];

    // For scatter, apply axis limits only when not zoomed
    const scatterXDomain = scatterDomain ? scatterDomain.x : (xDomainNumeric || undefined);
    const scatterYDomain = scatterDomain ? scatterDomain.y : (yDomain || undefined);
    const scatterAllowOverflow = !!scatterDomain || !!xDomainNumeric || !!yDomain;

    return chartWrap(
          <ReScatterChart
            key={seriesOrderKey}
            margin={margin}
            onMouseDown={scatterMouseDown}
            onMouseMove={scatterMouseMove}
            onMouseUp={() => scatterMouseUp(scatterData)}
            onDoubleClick={() => scatterDoubleClick(scatterData)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              type="number"
              dataKey="x"
              name={xCol}
              fontSize={11}
              domain={scatterXDomain}
              allowDataOverflow={scatterAllowOverflow}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yCol}
              fontSize={11}
              domain={scatterYDomain}
              allowDataOverflow={scatterAllowOverflow}
            />
            <ReTooltip cursor={{ strokeDasharray: '3 3' }} content={renderTooltip} />
            <Scatter name={scatterName} data={filteredScatterData} fill={palette[0]}>
              {filteredScatterData.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
            </Scatter>
            {refAreaLeft != null && refAreaRight != null && (
              <ReferenceArea x1={Number(refAreaLeft)} x2={Number(refAreaRight)} {...{fill: "#8884d8", fillOpacity: 0.2} as any} />
            )}
          </ReScatterChart>
    );
  }

  if (chartType === 'pie') {
    const allPieData = chartData.map(row => {
      let total = 0;
      for (const col of seriesCols) total += N(row[col]);
      return { name: String(row[xKey]), value: total };
    }).filter(d => d.value > 0);

    // For pie, filtering is based on slice names (not seriesCols)
    const pieVisible = (name: string) => {
      if (soloSeries != null) return soloSeries === name && !hiddenSeries.has(name);
      return !hiddenSeries.has(name);
    };
    const pieData = allPieData.filter(d => pieVisible(d.name));

    // Build a full legend payload so all slices always appear in legend
    const pieLegendPayload = allPieData.map((d, i) => ({
      value: d.name,
      color: palette[i % palette.length],
      type: 'square' as const,
    }));

    const pieLegendEl = legendEnabled !== false ? renderLegend({ payload: pieLegendPayload }) : null;

    return chartWrap(
          <RePieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="70%"
              label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
              labelLine
              {...labelProps}
            >
              {pieData.map((d, i) => {
                // Find the original index in allPieData to keep colors consistent
                const origIdx = allPieData.findIndex(p => p.name === d.name);
                return <Cell key={i} fill={palette[(origIdx >= 0 ? origIdx : i) % palette.length]} />;
              })}
            </Pie>
            <ReTooltip content={renderTooltip} />
          </RePieChart>,
      pieLegendEl,
    );
  }

  return null;
}

/* ── Shared Format Panel Components ─────────────────────────────── */

const SECTION_HEADER_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px',
};

const CHART_SECTION_HEADER_STYLE: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
};

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 32,
        height: 18,
        borderRadius: 9,
        border: 'none',
        background: checked ? '#0777b3' : '#ccc',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 16 : 2,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

function FontSizeInput({
  label, value, onChange, min = 1, max = 96, defaultVal = 12,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; defaultVal?: number;
}) {
  const [text, setText] = useState(String(value));
  const prevValue = useRef(value);
  // Sync text when value changes externally
  if (value !== prevValue.current) {
    prevValue.current = value;
    const num = Number(text);
    if (num !== value) setText(String(value));
  }
  const num = Number(text);
  const isValid = text.trim() !== '' && !isNaN(num) && num >= min && num <= max;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
      <span style={{ fontSize: 11, color: '#6a6a6a' }}>{label}</span>
      <input
        type="number"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const n = Number(raw);
          if (raw.trim() !== '' && !isNaN(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => {
          if (!isValid) { setText(String(value)); }
        }}
        style={{
          fontSize: 11, padding: '3px 6px', border: `1px solid ${isValid ? '#e0e0e0' : '#e74c3c'}`, borderRadius: 4,
          outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' as const,
        }}
      />
      {!isValid && (
        <span style={{ fontSize: 9, color: '#e74c3c', marginTop: 1 }}>
          Must be {min}–{max}
        </span>
      )}
    </label>
  );
}

function FontSizePair({
  headerValue, dataValue, onHeaderChange, onDataChange,
}: {
  headerValue: number; dataValue: number;
  onHeaderChange: (v: number) => void; onDataChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>Font Size</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <FontSizeInput label="Headers" value={headerValue} onChange={onHeaderChange} />
        <FontSizeInput label="Data" value={dataValue} onChange={onDataChange} />
      </div>
    </div>
  );
}

type ColumnTextFormat = { bold?: boolean; italic?: boolean; underline?: boolean; color?: string; bgColor?: string; align?: 'left' | 'center' | 'right'; numberFormat?: string };

/* ── Data Format Types & Helpers ─────────────────────────────────── */

interface DataFormatSettings {
  thousandsSeparator: boolean;  // default true
  currency: '' | '$' | '\u20AC';     // default '' (\u20AC = €)
  percent: boolean;              // default false
  decimalPlaces: number | null;  // null = auto
  dateFormat: string;            // '' = auto, or a format preset key / custom string
}

const DEFAULT_DATA_FORMAT: DataFormatSettings = {
  thousandsSeparator: true,
  currency: '',
  percent: false,
  decimalPlaces: null,
  dateFormat: '',
};

const DATE_FORMAT_PRESETS = [
  { value: '', label: 'Auto (raw value)' },
  { value: 'iso', label: 'YYYY-MM-DD HH:mm:ss' },
  { value: 'date-only', label: 'YYYY-MM-DD' },
  { value: 'us', label: 'MM/DD/YYYY' },
  { value: 'eu', label: 'DD/MM/YYYY' },
  { value: 'medium', label: 'MMM D, YYYY' },
  { value: 'medium-eu', label: 'D MMM YYYY' },
  { value: 'datetime-short', label: 'YYYY-MM-DD HH:mm' },
  { value: 'custom', label: 'Custom...' },
];

function looksLikeDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s);
}

function formatDate(dateStr: string, format: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const h = d.getHours();
  const mi = d.getMinutes();
  const s = d.getSeconds();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  switch (format) {
    case 'iso': return `${y}-${pad(mo+1)}-${pad(day)} ${pad(h)}:${pad(mi)}:${pad(s)}`;
    case 'date-only': return `${y}-${pad(mo+1)}-${pad(day)}`;
    case 'us': return `${pad(mo+1)}/${pad(day)}/${y}`;
    case 'eu': return `${pad(day)}/${pad(mo+1)}/${y}`;
    case 'medium': return `${months[mo]} ${day}, ${y}`;
    case 'medium-eu': return `${day} ${months[mo]} ${y}`;
    case 'datetime-short': return `${y}-${pad(mo+1)}-${pad(day)} ${pad(h)}:${pad(mi)}`;
    default:
      return format
        .replace('YYYY', String(y))
        .replace('MMM', months[mo])
        .replace('MM', pad(mo+1))
        .replace('DD', pad(day))
        .replace('HH', pad(h))
        .replace('mm', pad(mi))
        .replace('ss', pad(s));
  }
}

function formatCellValue(
  val: unknown,
  globalFmt: DataFormatSettings,
  columnFmt?: DataFormatSettings,
): string {
  if (val == null) return '';
  const fmt = columnFmt || globalFmt;
  const isNum = typeof val === 'number' || typeof val === 'bigint';
  if (isNum) {
    let num = N(val);
    if (fmt.percent) num *= 100;
    let formatted: string;
    if (fmt.decimalPlaces != null) {
      formatted = fmt.thousandsSeparator
        ? num.toLocaleString(undefined, { minimumFractionDigits: fmt.decimalPlaces, maximumFractionDigits: fmt.decimalPlaces })
        : num.toFixed(fmt.decimalPlaces);
    } else {
      formatted = fmt.thousandsSeparator ? num.toLocaleString() : String(num);
    }
    if (fmt.currency) formatted = fmt.currency + formatted;
    if (fmt.percent) formatted += '%';
    return formatted;
  }
  const strVal = String(val);
  if (fmt.dateFormat && looksLikeDate(strVal)) {
    return formatDate(strVal, fmt.dateFormat);
  }
  return strVal;
}

/* ── Data Format Settings UI ─────────────────────────────────────── */

function DataFormatEditor({
  fmt, setFmt, label,
}: {
  fmt: DataFormatSettings;
  setFmt: (updater: (prev: DataFormatSettings) => DataFormatSettings) => void;
  label?: string;
}) {
  const selectedPreset = DATE_FORMAT_PRESETS.find(p => p.value === fmt.dateFormat) ? fmt.dateFormat
    : (fmt.dateFormat ? 'custom' : '');
  return (
    <div>
      {label && <div style={{ fontSize: 10, fontWeight: 600, color: '#6a6a6a', marginBottom: 6 }}>{label}</div>}
      {/* Number formatting */}
      <div style={{ fontSize: 10, fontWeight: 600, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Numbers</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#333', cursor: 'pointer' }}>
          <input type="checkbox" checked={fmt.thousandsSeparator}
            onChange={(e) => setFmt(p => ({ ...p, thousandsSeparator: e.target.checked }))}
            style={{ margin: 0 }} />
          Thousands separator (commas)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#333', minWidth: 55 }}>Currency</span>
          <select value={fmt.currency}
            onChange={(e) => setFmt(p => ({ ...p, currency: e.target.value as DataFormatSettings['currency'] }))}
            style={{ fontSize: 11, padding: '2px 4px', border: '1px solid #d0d0d0', borderRadius: 4, background: '#fff', fontFamily: 'inherit' }}>
            <option value="">None</option>
            <option value="$">$ (USD)</option>
            <option value={'\u20AC'}>{'\u20AC'} (Euro)</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#333', cursor: 'pointer' }}>
          <input type="checkbox" checked={fmt.percent}
            onChange={(e) => setFmt(p => ({ ...p, percent: e.target.checked }))}
            style={{ margin: 0 }} />
          Percent (multiply by 100, append %)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#333', minWidth: 90 }}>Decimal places</span>
          <input
            type="number" min={0} max={20}
            value={fmt.decimalPlaces != null ? fmt.decimalPlaces : ''}
            placeholder="auto"
            onChange={(e) => setFmt(p => ({ ...p, decimalPlaces: e.target.value === '' ? null : Math.max(0, Math.min(20, parseInt(e.target.value) || 0)) }))}
            style={{ width: 56, fontSize: 11, padding: '2px 4px', border: '1px solid #d0d0d0', borderRadius: 4, fontFamily: 'inherit' }}
          />
        </div>
      </div>
      {/* Date/Time formatting */}
      <div style={{ fontSize: 10, fontWeight: 600, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Dates & Times</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <select value={selectedPreset}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'custom') setFmt(p => ({ ...p, dateFormat: p.dateFormat || 'YYYY-MM-DD' }));
            else setFmt(p => ({ ...p, dateFormat: v }));
          }}
          style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #d0d0d0', borderRadius: 4, background: '#fff', fontFamily: 'inherit', width: '100%' }}>
          {DATE_FORMAT_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {selectedPreset === 'custom' && (
          <input type="text" value={fmt.dateFormat}
            onChange={(e) => setFmt(p => ({ ...p, dateFormat: e.target.value }))}
            placeholder="e.g. YYYY-MM-DD HH:mm"
            style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #d0d0d0', borderRadius: 4, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
        )}
      </div>
    </div>
  );
}

function DataFormatSection({
  globalFmt, setGlobalFmt, columnFormats, setColumnFormats, availableColumns,
}: {
  globalFmt: DataFormatSettings;
  setGlobalFmt: React.Dispatch<React.SetStateAction<DataFormatSettings>>;
  columnFormats: Record<string, DataFormatSettings>;
  setColumnFormats: React.Dispatch<React.SetStateAction<Record<string, DataFormatSettings>>>;
  availableColumns: string[];
}) {
  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>Data Formatting</div>
      <DataFormatEditor fmt={globalFmt} setFmt={(updater) => setGlobalFmt(prev => updater(prev))} />

      {/* Per-column overrides */}
      {Object.entries(columnFormats).length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#999', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Column Overrides</div>
          {Object.entries(columnFormats).map(([col, colFmt]) => (
            <div key={col} style={{ marginBottom: 10, padding: 8, background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col}>{col}</span>
                <button
                  onClick={() => setColumnFormats(prev => { const next = { ...prev }; delete next[col]; return next; })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#999', padding: '0 2px', lineHeight: 1 }}
                  title="Remove override"
                >
                  ×
                </button>
              </div>
              <DataFormatEditor
                fmt={colFmt}
                setFmt={(updater) => setColumnFormats(prev => ({ ...prev, [col]: updater(prev[col]) }))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Override dropdown */}
      {(() => {
        const availableCols = availableColumns.filter(c => !(c in columnFormats));
        if (availableCols.length === 0) return null;
        return (
          <select
            value=""
            onChange={(e) => { if (e.target.value) setColumnFormats(prev => ({ ...prev, [e.target.value]: { ...DEFAULT_DATA_FORMAT } })); }}
            style={{
              fontSize: 11, padding: '4px 6px', border: '1px solid #d0d0d0', borderRadius: 4,
              background: '#fff', color: '#0777b3', cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 8,
            }}
          >
            <option value="">+ Add Column Override...</option>
            {availableCols.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        );
      })()}
    </div>
  );
}

function ColumnTextFormatSection({
  formats, setFormats, availableColumns,
}: {
  formats: Record<string, ColumnTextFormat>;
  setFormats: React.Dispatch<React.SetStateAction<Record<string, ColumnTextFormat>>>;
  availableColumns: string[];
}) {
  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>Column Text Formatting</div>
      {Object.entries(formats).map(([col, fmt]) => (
        <div key={col} style={{ marginBottom: 10, padding: 8, background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col}>
              {col}
            </span>
            <button
              onClick={() => setFormats((prev) => { const next = { ...prev }; delete next[col]; return next; })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#999', padding: '0 2px', lineHeight: 1 }}
              title="Remove formatting"
            >
              ×
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {/* Bold / Italic / Underline toggles */}
            {([
              ['bold', 'B', { fontWeight: 700 }],
              ['italic', 'I', { fontStyle: 'italic' }],
              ['underline', 'U', { textDecoration: 'underline' }],
            ] as [keyof typeof fmt, string, React.CSSProperties][]).map(([key, label, activeStyle]) => (
              <button
                key={key}
                onClick={() => setFormats((prev) => ({ ...prev, [col]: { ...prev[col], [key]: !prev[col]?.[key] } }))}
                style={{
                  width: 24, height: 24, fontSize: 11, fontFamily: 'inherit',
                  border: '1px solid ' + (fmt[key] ? '#0777b3' : '#d0d0d0'), borderRadius: 4,
                  background: fmt[key] ? '#e8f4fb' : '#fff', color: fmt[key] ? '#0777b3' : '#555',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  ...(fmt[key] ? activeStyle : {}),
                }}
                title={String(key)}
              >
                {label}
              </button>
            ))}
            <div style={{ width: 1, height: 18, background: '#e0e0e0', margin: '0 2px' }} />
            {/* Text color */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} title="Text color">
              <span style={{ fontSize: 10, color: '#6a6a6a' }}>A</span>
              <input type="color" value={fmt.color || '#000000'}
                onChange={(e) => setFormats((prev) => ({ ...prev, [col]: { ...prev[col], color: e.target.value } }))}
                style={{ width: 20, height: 20, padding: 0, border: '1px solid #d0d0d0', borderRadius: 3, cursor: 'pointer' }} />
            </label>
            {/* Background color */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} title="Background color">
              <span style={{ fontSize: 10, color: '#6a6a6a', background: '#eee', padding: '0 3px', borderRadius: 2 }}>bg</span>
              <input type="color" value={fmt.bgColor || '#ffffff'}
                onChange={(e) => setFormats((prev) => ({ ...prev, [col]: { ...prev[col], bgColor: e.target.value } }))}
                style={{ width: 20, height: 20, padding: 0, border: '1px solid #d0d0d0', borderRadius: 3, cursor: 'pointer' }} />
            </label>
            <div style={{ width: 1, height: 18, background: '#e0e0e0', margin: '0 2px' }} />
            {/* Alignment toggles */}
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => setFormats((prev) => ({ ...prev, [col]: { ...prev[col], align } }))}
                style={{
                  padding: '3px 8px', fontSize: 10, fontFamily: 'inherit',
                  border: '1px solid ' + (fmt.align === align ? '#0777b3' : '#d0d0d0'), borderRadius: 4,
                  background: fmt.align === align ? '#0777b3' : '#fff', color: fmt.align === align ? '#fff' : '#333',
                  cursor: 'pointer', textTransform: 'capitalize' as const,
                }}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      ))}
      {/* Add column text format */}
      {(() => {
        const availableCols = availableColumns.filter((c) => !(c in formats));
        if (availableCols.length === 0) return null;
        return (
          <select
            value=""
            onChange={(e) => { if (e.target.value) setFormats((prev) => ({ ...prev, [e.target.value]: {} })); }}
            style={{
              fontSize: 11, padding: '4px 6px', border: '1px solid #d0d0d0', borderRadius: 4,
              background: '#fff', color: '#0777b3', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
            }}
          >
            <option value="">+ Add Override...</option>
            {availableCols.map((col) => <option key={col} value={col}>{col}</option>)}
          </select>
        );
      })()}
    </div>
  );
}

type ColWidthMode = 'name' | 'data' | 'fixed';

/* ── Dashboard tile type ─────────────────────────────────────── */
type DashboardTile = {
  id: string;
  tabId: string;       // references a pivot/chart/drilldown tab
  x: number;           // px from left
  y: number;           // px from top
  w: number;           // width in px
  h: number;           // height in px
};
type DashboardState = {
  tiles: DashboardTile[];
  nextTileId: number;
};

// Stable empty references to avoid recreating objects/arrays each render
const EMPTY_DIM_ARR: DimItem[] = [];
const EMPTY_QUAD_ARR: QuadItem[] = [];
const EMPTY_COND_ARR: ConditionalFormatRule[] = [];
const EMPTY_STR_MAP: Record<string, any> = {};
const EMPTY_NUM_MAP: Record<string, number> = {};

function computeColWidth(
  col: string,
  mode: ColWidthMode,
  overrides: Record<string, number>,
  opts: { maxDataWidth: number; fixedWidth: number; dataRows?: Record<string, unknown>[] }
): number {
  if (overrides[col] != null) return overrides[col];
  switch (mode) {
    case 'name':
      return Math.max(20, Math.min(200, col.length * 9 + 40));
    case 'data': {
      const nameW = col.length * 9 + 40;
      let maxW = nameW;
      if (opts.dataRows) {
        for (let i = 0; i < Math.min(100, opts.dataRows.length); i++) {
          const val = String(opts.dataRows[i]?.[col] ?? '');
          const w = val.length * 8 + 20;
          if (w > maxW) maxW = w;
        }
      }
      return Math.max(20, Math.min(maxW, opts.maxDataWidth));
    }
    case 'fixed':
      return opts.fixedWidth;
  }
}

function PixelWidthInput({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const prevValue = useRef(value);
  if (value !== prevValue.current) {
    prevValue.current = value;
    const num = Number(text);
    if (num !== value) setText(String(value));
  }
  const num = Number(text);
  const isValid = text.trim() !== '' && !isNaN(num) && num >= 1 && num <= 10000;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 18 }}>
      <span style={{ fontSize: 11, color: '#6a6a6a', marginTop: 4 }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            value={text}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const raw = e.target.value;
              setText(raw);
              const n = Number(raw);
              if (raw.trim() !== '' && !isNaN(n) && n >= 1 && n <= 10000) onChange(n);
            }}
            onBlur={() => { if (!isValid) setText(String(value)); }}
            style={{
              width: 60, fontSize: 11, padding: '2px 4px',
              border: `1px solid ${isValid ? '#e0e0e0' : '#e74c3c'}`, borderRadius: 4,
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <span style={{ fontSize: 10, color: '#999' }}>px</span>
        </div>
        {!isValid && (
          <span style={{ fontSize: 9, color: '#e74c3c', marginTop: 1 }}>Must be 1–10000</span>
        )}
      </div>
    </div>
  );
}

function OverridePixelInput({
  value, onChange,
}: {
  value: number; onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const prevValue = useRef(value);
  if (value !== prevValue.current) {
    prevValue.current = value;
    const num = Number(text);
    if (num !== value) setText(String(value));
  }
  const num = Number(text);
  const isValid = text.trim() !== '' && !isNaN(num) && num >= 1 && num <= 10000;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          value={text}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            setText(raw);
            const n = Number(raw);
            if (raw.trim() !== '' && !isNaN(n) && n >= 1 && n <= 10000) onChange(n);
          }}
          onBlur={() => { if (!isValid) setText(String(value)); }}
          style={{
            width: 55, fontSize: 11, padding: '2px 4px',
            border: `1px solid ${isValid ? '#e0e0e0' : '#e74c3c'}`, borderRadius: 4,
            outline: 'none', fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 10, color: '#999' }}>px</span>
      </div>
      {!isValid && (
        <span style={{ fontSize: 9, color: '#e74c3c', marginTop: 1 }}>1–10000</span>
      )}
    </div>
  );
}

function ColumnWidthSection({
  mode, setMode, maxDataWidth, setMaxDataWidth, fixedWidth, setFixedWidth,
  overrides, setOverrides, availableColumns, radioName,
}: {
  mode: ColWidthMode;
  setMode: (m: ColWidthMode) => void;
  maxDataWidth: number; setMaxDataWidth: (v: number) => void;
  fixedWidth: number; setFixedWidth: (v: number) => void;
  overrides: Record<string, number>;
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  availableColumns: string[];
  radioName?: string;
}) {
  const rName = radioName || 'colWidthMode';
  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>Column Widths</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(['name', 'data', 'fixed'] as const).map(m => (
          <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
            <input type="radio" name={rName} checked={mode === m} onChange={() => setMode(m)} style={{ margin: 0 }} />
            {m === 'name' ? 'Fit to Column Name' : m === 'data' ? 'Fit to Data' : 'Fixed Width'}
          </label>
        ))}
        {mode === 'data' && (
          <PixelWidthInput label="Max width" value={maxDataWidth} onChange={setMaxDataWidth} />
        )}
        {mode === 'fixed' && (
          <PixelWidthInput label="Width" value={fixedWidth} onChange={setFixedWidth} />
        )}
      </div>
      {Object.entries(overrides).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', marginBottom: 4 }}>Column Overrides</div>
          {Object.entries(overrides).map(([col, w]) => (
            <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={col}>{col}</span>
              <OverridePixelInput value={w} onChange={(v: number) => setOverrides(prev => ({ ...prev, [col]: v }))} />
              <button onClick={() => setOverrides(prev => { const next = { ...prev }; delete next[col]; return next; })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#999', padding: '0 2px', lineHeight: 1 }} title="Remove">×</button>
            </div>
          ))}
        </div>
      )}
      {(() => {
        const availableCols = availableColumns.filter(c => !(c in overrides));
        if (availableCols.length === 0) return null;
        return (
          <select value="" onChange={e => { if (e.target.value) setOverrides(prev => ({ ...prev, [e.target.value]: 150 })); }}
            style={{ fontSize: 11, padding: '4px 6px', border: '1px solid #d0d0d0', borderRadius: 4, background: '#fff', color: '#0777b3', cursor: 'pointer', fontFamily: 'inherit', width: '100%', marginTop: 6 }}>
            <option value="">+ Add Column Override...</option>
            {availableCols.map(col => <option key={col} value={col}>{col}</option>)}
          </select>
        );
      })()}
    </div>
  );
}

function ConditionalFormatSection({
  rules, setRules, columns, idPrefix, nextIdRef,
}: {
  rules: ConditionalFormatRule[];
  setRules: React.Dispatch<React.SetStateAction<ConditionalFormatRule[]>>;
  columns: string[];
  idPrefix: string;
  nextIdRef: React.MutableRefObject<number>;
}) {
  return (
    <div>
      <div style={SECTION_HEADER_STYLE}>Conditional Formatting</div>
      {rules.map((rule, idx) => (
        <div key={rule.id} style={{ marginBottom: 10, padding: 8, background: '#fafafa', borderRadius: 6, border: '1px solid #eee' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase' }}>Rule {idx + 1}</span>
            <button
              onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#999', padding: '0 2px', lineHeight: 1 }}
              title="Remove rule"
            >
              ×
            </button>
          </div>
          {/* Apply to */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: '#6a6a6a', flexShrink: 0, width: 52 }}>Apply to</span>
            <select
              value={rule.applyTo}
              onChange={(e) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, applyTo: e.target.value as 'row' | string } : r))}
              style={{ flex: 1, fontSize: 11, padding: '3px 4px', border: '1px solid #e0e0e0', borderRadius: 4, fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="row">Entire Row</option>
              {columns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          {/* When column */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: '#6a6a6a', flexShrink: 0, width: 52 }}>When</span>
            <select
              value={rule.conditionColumn}
              onChange={(e) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, conditionColumn: e.target.value } : r))}
              style={{ flex: 1, fontSize: 11, padding: '3px 4px', border: '1px solid #e0e0e0', borderRadius: 4, fontFamily: 'inherit', background: '#fff' }}
            >
              <option value="">Select column...</option>
              {columns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
          {/* Operator + Value */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <select
              value={rule.operator}
              onChange={(e) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, operator: e.target.value as ConditionalFormatRule['operator'] } : r))}
              style={{ fontSize: 11, padding: '3px 4px', border: '1px solid #e0e0e0', borderRadius: 4, fontFamily: 'inherit', background: '#fff', width: 90, flexShrink: 0 }}
            >
              <option value="==">==</option>
              <option value="!=">!=</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">&gt;=</option>
              <option value="<=">&lt;=</option>
              <option value="like">like</option>
              <option value="contains">contains</option>
              <option value="not_contains">not contains</option>
              <option value="starts_with">starts with</option>
              <option value="ends_with">ends with</option>
            </select>
            <input
              type="text"
              value={rule.value}
              onChange={(e) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, value: e.target.value } : r))}
              placeholder="Value"
              style={{ flex: 1, fontSize: 11, padding: '3px 6px', border: '1px solid #e0e0e0', borderRadius: 4, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          {/* Style options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {/* Bold / Italic / Underline */}
            {([
              ['bold', 'B', { fontWeight: 700 }],
              ['italic', 'I', { fontStyle: 'italic' }],
              ['underline', 'U', { textDecoration: 'underline' }],
            ] as ['bold' | 'italic' | 'underline', string, React.CSSProperties][]).map(([key, label, activeStyle]) => (
              <button
                key={key}
                onClick={() => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, [key]: !r[key] } : r))}
                style={{
                  width: 24, height: 24, fontSize: 11, fontFamily: 'inherit',
                  border: '1px solid ' + (rule[key] ? '#0777b3' : '#d0d0d0'), borderRadius: 4,
                  background: rule[key] ? '#e8f4fb' : '#fff', color: rule[key] ? '#0777b3' : '#555',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  ...(rule[key] ? activeStyle : {}),
                }}
                title={key}
              >
                {label}
              </button>
            ))}
            <div style={{ width: 1, height: 18, background: '#e0e0e0', margin: '0 2px' }} />
            {/* Font color */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} title="Font color">
              <span style={{ fontSize: 10, color: '#6a6a6a' }}>A</span>
              <input type="color" value={rule.fontColor || '#000000'}
                onChange={(e) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, fontColor: e.target.value } : r))}
                style={{ width: 20, height: 20, padding: 0, border: '1px solid #d0d0d0', borderRadius: 3, cursor: 'pointer' }} />
            </label>
            {/* Background color */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }} title="Background color">
              <span style={{ fontSize: 10, color: '#6a6a6a', background: '#eee', padding: '0 3px', borderRadius: 2 }}>bg</span>
              <input type="color" value={rule.bgColor || '#ffffff'}
                onChange={(e) => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, bgColor: e.target.value } : r))}
                style={{ width: 20, height: 20, padding: 0, border: '1px solid #d0d0d0', borderRadius: 3, cursor: 'pointer' }} />
            </label>
          </div>
        </div>
      ))}
      <button
        onClick={() => {
          const newId = `${idPrefix}${nextIdRef.current++}`;
          setRules((prev) => [...prev, { id: newId, applyTo: 'row', conditionColumn: columns[0] || '', operator: '==', value: '' }]);
        }}
        style={{
          fontSize: 11, padding: '5px 10px', border: '1px solid #d0d0d0', borderRadius: 4,
          background: '#fff', color: '#0777b3', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
        }}
      >
        + Add Rule
      </button>
    </div>
  );
}

/* ── Drilldown Table ──────────────────────────────────────────── */
function DrilldownTable({ sql, tableId, rowLimit, maxRowCount, title, titleFontSize, titlePosition, headerFontSize, dataFontSize, columnTextFormats, conditionalFormats, colWidthMode, colWidthMaxData, colWidthFixed, colWidthOverrides, setColWidthOverrides, dataFormat: dataFormatProp, columnDataFormats: columnDataFormatsProp }: {
  sql: string;
  tableId: number;
  rowLimit: number;
  maxRowCount?: number;
  title?: string;
  titleFontSize?: number;
  titlePosition?: 'left' | 'center' | 'right';
  headerFontSize?: number;
  dataFontSize?: number;
  columnTextFormats?: Record<string, { bold?: boolean; italic?: boolean; underline?: boolean; color?: string; bgColor?: string; align?: 'left' | 'center' | 'right'; numberFormat?: string }>;
  conditionalFormats?: ConditionalFormatRule[];
  colWidthMode?: ColWidthMode;
  colWidthMaxData?: number;
  colWidthFixed?: number;
  colWidthOverrides?: Record<string, number>;
  setColWidthOverrides?: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  dataFormat?: DataFormatSettings;
  columnDataFormats?: Record<string, DataFormatSettings>;
}) {
  // Step 1: Create temp table from drilldown SQL (expensive)
  const tempTableName = `drilldown_results_${tableId}`;
  const createTempSql = useMemo(() => {
    if (!sql) return '';
    const limit = maxRowCount ? ` LIMIT ${maxRowCount}` : '';
    return `CREATE OR REPLACE TEMP TABLE ${tempTableName} AS ${sql}${limit}`;
  }, [sql, tempTableName, maxRowCount]);
  const createTempQ = useSQLQuery(createTempSql, { enabled: createTempSql.length > 0 });

  // Sort state
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [drillPage, setDrillPage] = useState(0);

  // Count query for pagination
  const countSql = useMemo(() => {
    if (!createTempQ.isSuccess) return '';
    return `SELECT count(*)::INTEGER as cnt FROM ${tempTableName} -- v${createTempSql.length}`;
  }, [createTempQ.isSuccess, createTempSql, tempTableName]);
  const countQ = useSQLQuery(countSql, { enabled: createTempQ.isSuccess && countSql.length > 0 });
  const drillTotalRows = useMemo(() => {
    const rows = Array.isArray(countQ.data) ? countQ.data : [];
    return rows.length > 0 ? Number(rows[0].cnt) : 0;
  }, [countQ.data]);

  // Reset page when sort or rows-per-page changes
  useEffect(() => { setDrillPage(0); }, [sortColumns, rowLimit]);

  // Step 2: Select from temp table (cheap — supports sorting + pagination)
  const selectSql = useMemo(() => {
    if (!createTempQ.isSuccess) return '';
    const orderBy = buildOrderByClause(sortColumns);
    const offset = drillPage * rowLimit;
    return `SELECT * FROM ${tempTableName}${orderBy} LIMIT ${rowLimit} OFFSET ${offset} -- v${createTempSql.length}`;
  }, [createTempQ.isSuccess, createTempSql, tempTableName, sortColumns, drillPage, rowLimit]);

  const q = useSQLQuery(selectSql, { enabled: createTempQ.isSuccess && selectSql.length > 0 });
  const lastDrillRowsRef = useRef<any[]>([]);
  const rows = useMemo(() => {
    const fresh = Array.isArray(q.data) ? q.data : null;
    if (fresh) { lastDrillRowsRef.current = fresh; return fresh; }
    if (q.isLoading && createTempQ.isSuccess && lastDrillRowsRef.current.length > 0) return lastDrillRowsRef.current;
    return [];
  }, [q.data, q.isLoading, createTempQ.isSuccess]);
  const cols = useMemo(() => rows.length > 0 ? Object.keys(rows[0]) : [], [rows]);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const colResizing = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;
  const [tblFilters, setTblFilters] = useState<Record<string, Set<string>>>({});
  const [filterPopup, setFilterPopup] = useState<string | null>(null);
  const filterApplyRef = useRef<(() => void) | null>(null);

  const _cwMode = colWidthMode || 'name';
  const _cwMaxData = colWidthMaxData ?? 300;
  const _cwFixed = colWidthFixed ?? 150;
  const _cwOverrides = colWidthOverrides || {};

  useEffect(() => {
    if (cols.length > 0) {
      setColWidths(() => {
        const next: Record<string, number> = {};
        for (const col of cols) {
          next[col] = computeColWidth(col, _cwMode, _cwOverrides, {
            maxDataWidth: _cwMaxData,
            fixedWidth: _cwFixed,
            dataRows: rows,
          });
        }
        return next;
      });
    }
  }, [cols, _cwMode, _cwOverrides, _cwMaxData, _cwFixed, rows]);

  const drillRafId = useRef(0);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (colResizing.current) {
        const { col, startX, startW } = colResizing.current;
        const newW = Math.max(20, startW + e.clientX - startX);
        cancelAnimationFrame(drillRafId.current);
        drillRafId.current = requestAnimationFrame(() => {
          setColWidths(prev => ({ ...prev, [col]: newW }));
        });
      }
    };
    const onUp = () => {
      cancelAnimationFrame(drillRafId.current);
      if (colResizing.current && setColWidthOverrides) {
        const { col } = colResizing.current;
        const finalWidth = colWidthsRef.current[col];
        if (finalWidth) setColWidthOverrides(prev => ({ ...prev, [col]: finalWidth }));
      }
      colResizing.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    if (!filterPopup) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-filter-popup]")) {
        if (filterApplyRef.current) filterApplyRef.current();
        else setFilterPopup(null);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [filterPopup]);

  const filteredData = useMemo(() => {
    const active = Object.entries(tblFilters).filter(([, v]) => v != null) as [string, Set<string>][];
    if (active.length === 0) return rows;
    return rows.filter(row => active.every(([col, sel]) => sel.has(String(row[col] ?? ""))));
  }, [rows, tblFilters]);

  // Cascaded data: rows filtered by all OTHER column filters (excluding the open popup's column)
  const cascadedData = useMemo(() => {
    if (!filterPopup) return rows;
    const otherFilters = Object.entries(tblFilters)
      .filter(([col, v]) => v != null && col !== filterPopup) as [string, Set<string>][];
    if (otherFilters.length === 0) return rows;
    return rows.filter(row => otherFilters.every(([col, sel]) => sel.has(String(row[col] ?? ""))));
  }, [rows, tblFilters, filterPopup]);

  const drilldownColTypes = useMemo(() => {
    const map: Record<string, ColType> = {};
    for (const c of cols) map[c] = detectColumnType(c, rows);
    return map;
  }, [cols, rows]);

  if (createTempQ.isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "#6a6a6a", fontSize: 13 }}>
        <Loader2 className="animate-spin" size={16} /> Loading drilldown data...
      </div>
    );
  }
  if (q.isError || createTempQ.isError) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ background: "#fef2f2", borderRadius: 6, padding: 16, color: "#bc1200" }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Drilldown Error</div>
          <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{createTempQ.error?.message || q.error?.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, padding: "16px 16px 0" }}>
      {title && (
        <div style={{
          textAlign: titlePosition || 'center',
          fontSize: titleFontSize || 16,
          fontWeight: 600,
          color: '#231f20',
          padding: '0 0 6px',
          flexShrink: 0,
        }}>
          {title}
        </div>
      )}
      <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 8, flexShrink: 0 }}>
        {drillTotalRows > rowLimit ? (
          <PaginationBar page={drillPage} totalRows={drillTotalRows} rowLimit={rowLimit} onPageChange={setDrillPage} />
        ) : (
          <span>
            {filteredData.length.toLocaleString()} row{filteredData.length !== 1 ? "s" : ""}
            {Object.values(tblFilters).some(v => v != null) && ` (filtered from ${rows.length.toLocaleString()})`}
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
      <table style={{ borderCollapse: "collapse", tableLayout: "fixed", fontSize: dataFontSize || 12 }}>
        <thead>
          <tr>
            {cols.map(col => (
              <th key={col}
                onDoubleClick={() => setSortColumns(prev => cycleSortColumn(prev, col))}
                style={{
                  width: colWidths[col] || 120, minWidth: 20, textAlign: "left", fontWeight: 600,
                  padding: "6px 10px", borderBottom: "2px solid #d0d0d0", background: "#fff",
                  position: "sticky", top: 0, whiteSpace: "nowrap", zIndex: filterPopup === col ? 10 : 2,
                  fontSize: headerFontSize || 12, cursor: "pointer", userSelect: "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }} title={col}>{col}</span>
                  {(() => {
                    const si = sortColumns.findIndex(s => s.col === col);
                    return si !== -1 ? <SortIndicator direction={sortColumns[si].direction} order={si + 1} /> : null;
                  })()}
                  <button
                    data-filter-popup="true"
                    onClick={e => { e.stopPropagation(); setFilterPopup(filterPopup === col ? null : col); }}
                    style={{
                      background: "none", border: "none", padding: 2, cursor: "pointer",
                      color: tblFilters[col] != null ? "#0777b3" : "#adadad",
                      display: "flex", flexShrink: 0, borderRadius: 3,
                    }}
                  >
                    <Filter size={11} />
                  </button>
                </div>
                {filterPopup === col && (
                  <ColumnFilterDropdown
                    col={col} pivotData={rows} cascadedData={cascadedData} currentSelection={tblFilters[col] ?? null}
                    applyRef={filterApplyRef}
                    onApply={selected => {
                      setTblFilters(p => { const next = { ...p }; if (selected === null) delete next[col]; else next[col] = selected; return next; });
                      setFilterPopup(null);
                    }}
                    onCancel={() => setFilterPopup(null)}
                  />
                )}
                <div
                  onMouseDown={e => { e.preventDefault(); colResizing.current = { col, startX: e.clientX, startW: colWidths[col] || 120 }; }}
                  style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#0777b3")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.slice(0, 500).map((row, ri) => {
            return (
            <tr key={ri}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f8fa")}
              onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? "#fff" : "#fafafa")}
              style={{ background: ri % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f0f0f0" }}
            >
              {cols.map(col => {
                const val = row[col];
                const isNum = typeof val === "number" || typeof val === "bigint";
                const colDataFmt = columnDataFormatsProp?.[col];
                const display = dataFormatProp ? formatCellValue(val, dataFormatProp, colDataFmt) : (val == null ? "" : isNum ? N(val).toLocaleString() : String(val));
                const fmt = columnTextFormats?.[col];
                const condStyle = conditionalFormats && conditionalFormats.length > 0 ? getConditionalStyle(row, col, conditionalFormats, drilldownColTypes) : {};
                const rowBg = ri % 2 === 0 ? "#fff" : "#fafafa";
                return (
                  <td key={col} style={{
                    padding: "5px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    maxWidth: colWidths[col] || 120,
                    textAlign: fmt?.align || (isNum ? "right" : "left"),
                    fontVariantNumeric: isNum ? "tabular-nums" : undefined,
                    fontWeight: fmt?.bold ? 600 : undefined,
                    fontStyle: fmt?.italic ? 'italic' : undefined,
                    textDecoration: fmt?.underline ? 'underline' : undefined,
                    color: fmt?.color || undefined,
                    background: fmt?.bgColor || rowBg,
                    ...condStyle,
                  }} title={display}>{display}</td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

/* ── Dashboard Tile Content Renderer ────────────────────────────── */
function DashboardTileContent({ tabId, tabState, tabType }: {
  tabId: string;
  tabState: any;
  tabType: 'pivot' | 'chart' | 'drilldown';
}) {
  const tempTable = `pivot_table_results_${tabId.replace(/\W/g, '_')}`;
  const sql = tabType === 'drilldown' && tabState?.sql
    ? `${tabState.sql} LIMIT 1000`
    : `SELECT * FROM ${tempTable} LIMIT 10000`;
  const q = useSQLQuery(sql);
  const allData = useMemo(() => (Array.isArray(q.data) ? q.data : []) as Record<string, unknown>[], [q.data]);
  const columns = useMemo(() => allData.length > 0 ? Object.keys(allData[0]) : [], [allData]);

  // Local interactive state for the table
  const [tblFilters, setTblFilters] = useState<Record<string, Set<string>>>({});
  const [filterPopup, setFilterPopup] = useState<string | null>(null);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [localColWidths, setLocalColWidths] = useState<Record<string, number>>({});
  const colResizing = useRef<{ col: string; startX: number; startW: number } | null>(null);
  const filterApplyRef = useRef<(() => void) | null>(null);

  // Extract formatting from tabState — use stable references for objects/arrays
  const columnItems: DimItem[] = tabState?.columnItems || EMPTY_DIM_ARR;
  const rowItems: DimItem[] = tabState?.rowItems || EMPTY_DIM_ARR;
  const valueItems: QuadItem[] = tabState?.valueItems || EMPTY_QUAD_ARR;
  const valuesAxis = tabState?.valuesAxis || null;
  const showSubtotals = tabState?.showSubtotals || false;
  const showGrandTotals = tabState?.showGrandTotals || false;
  const columnNameReplacements: Record<string, string> = tabState?.columnNameReplacements || EMPTY_STR_MAP;
  const tableHeaderFontSize = tabState?.tableHeaderFontSize || 12;
  const tableDataFontSize = tabState?.tableDataFontSize || 12;
  const columnTextFormats = tabState?.columnTextFormats || EMPTY_STR_MAP;
  const conditionalFormats: ConditionalFormatRule[] = tabState?.conditionalFormats || EMPTY_COND_ARR;
  const dataFormat: DataFormatSettings = tabState?.dataFormat || DEFAULT_DATA_FORMAT;
  const columnDataFormats: Record<string, DataFormatSettings> = tabState?.columnDataFormats || EMPTY_STR_MAP;
  const colWidthMode: ColWidthMode = tabState?.colWidthMode || 'name';
  const colWidthMaxData = tabState?.colWidthMaxData || 300;
  const colWidthFixed = tabState?.colWidthFixed || 150;
  const colWidthOverrides: Record<string, number> = tabState?.colWidthOverrides || EMPTY_NUM_MAP;
  const rNames = useMemo(() => dimColNames(rowItems), [rowItems]);

  // Compute column types for conditional formatting
  const colTypes = useMemo(() => {
    const map: Record<string, ColType> = {};
    for (const c of columns) map[c] = detectColumnType(c, allData);
    return map;
  }, [columns, allData]);

  // Init column widths
  useEffect(() => {
    if (columns.length > 0) {
      setLocalColWidths(() => {
        const next: Record<string, number> = {};
        for (const col of columns) next[col] = computeColWidth(col, colWidthMode, colWidthOverrides, { maxDataWidth: colWidthMaxData, fixedWidth: colWidthFixed, dataRows: allData });
        return next;
      });
    }
  }, [columns, colWidthMode, colWidthMaxData, colWidthFixed, colWidthOverrides, allData]);

  // Column resize mouse handlers
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (colResizing.current) {
        const { col, startX, startW } = colResizing.current;
        setLocalColWidths(prev => ({ ...prev, [col]: Math.max(20, startW + e.clientX - startX) }));
      }
    };
    const handleUp = () => { colResizing.current = null; };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, []);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let rows = allData;
    for (const [col, vals] of Object.entries(tblFilters)) {
      if (vals) rows = rows.filter(r => vals.has(String(r[col] ?? '')));
    }
    if (sortColumns.length > 0) {
      const rowColSet = new Set(rNames);
      rows = [...rows].sort((a, b) => {
        for (const s of sortColumns) {
          const av = String(a[s.col] ?? '');
          const bv = String(b[s.col] ?? '');
          const ct = colTypes[s.col] || 'string';
          let cmp = 0;
          if (rowColSet.has(s.col)) {
            const aIsSpecial = av === 'Subtotal' || av === 'Grand Total';
            const bIsSpecial = bv === 'Subtotal' || bv === 'Grand Total';
            if (aIsSpecial && !bIsSpecial) return 1;
            if (!aIsSpecial && bIsSpecial) return -1;
          }
          if (ct === 'number') { cmp = (parseFloat(av) || 0) - (parseFloat(bv) || 0); }
          else { cmp = av.localeCompare(bv); }
          if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }
    return rows;
  }, [allData, tblFilters, sortColumns, rNames, colTypes]);

  // Cascaded data for filter dropdowns
  const cascadedData = useMemo(() => {
    const activeCols = Object.keys(tblFilters);
    if (activeCols.length === 0) return undefined;
    let rows = allData;
    for (const [col, vals] of Object.entries(tblFilters)) {
      if (vals && col !== filterPopup) rows = rows.filter(r => vals.has(String(r[col] ?? '')));
    }
    return rows;
  }, [allData, tblFilters, filterPopup]);

  // Row type detection
  const getRowType = useCallback((row: Record<string, unknown>): 'grand_total' | 'subtotal' | 'normal' => {
    if (rNames.length === 0) return 'normal';
    if (rNames.every(r => String(row[r]) === 'Grand Total')) return 'grand_total';
    if (rNames.some(r => String(row[r]) === 'Subtotal')) return 'subtotal';
    return 'normal';
  }, [rNames]);

  // Close filter on outside click
  useEffect(() => {
    if (!filterPopup) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-filter-popup]')) return;
      if (filterApplyRef.current) filterApplyRef.current();
      setFilterPopup(null);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [filterPopup]);

  const chartType = tabState?.chartType || 'table';
  const rowCols = useMemo(() => rowItems.map((r: any) => r.granularity ? `${r.col}_${r.granularity}` : r.col), [rowItems]);

  // Filter out subtotal/grand total for charts
  const chartData = useMemo(() => {
    if (chartType === 'table' || tabType === 'drilldown') return allData;
    return allData.filter(row => {
      for (const r of rNames) {
        const v = String(row[r] ?? '');
        if (v === 'Subtotal' || v === 'Grand Total') return false;
      }
      return true;
    });
  }, [allData, rNames, chartType, tabType]);

  if (q.isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6a6a6a', fontSize: 12 }}>
      <Loader2 className="animate-spin" size={14} />
    </div>
  );
  if (q.isError || allData.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#adadad', fontSize: 11 }}>
      {q.isError ? 'Error loading data' : 'No data'}
    </div>
  );

  // Big Number view
  if (chartType === 'big-number') {
    const seriesCols = columns.filter(c => !rowCols.includes(c) && c !== 'value_names');
    const firstValueCol = seriesCols[0];
    const numValue = firstValueCol && allData.length > 0 ? N(allData[0][firstValueCol]) : 0;
    const formattedValue = formatBigNumber(numValue, tabState?.bigNumberAbbreviate ?? true, tabState?.bigNumberDecimalPlaces ?? 0);
    const fontSize = tabState?.bigNumberFontSize ?? 48;
    const title = tabState?.bigNumberTitle || '';
    const titlePos = tabState?.bigNumberTitlePosition || 'above';
    const titleFontSize = tabState?.bigNumberTitleFontSize ?? 14;
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {title && titlePos === 'above' && (
            <div style={{ fontSize: titleFontSize, color: '#6a6a6a', fontWeight: 500 }}>{title}</div>
          )}
          <div style={{ fontSize, fontWeight: 700, color: '#231f20', lineHeight: 1.1 }}>
            {formattedValue}
          </div>
          {title && titlePos === 'below' && (
            <div style={{ fontSize: titleFontSize, color: '#6a6a6a', fontWeight: 500 }}>{title}</div>
          )}
        </div>
      </div>
    );
  }

  // Chart view
  if (chartType !== 'table' && tabType !== 'drilldown') {
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <PivotChart
          chartType={chartType}
          data={chartData}
          allColumns={columns}
          rowCols={rowCols}
          chartTitle={tabState?.chartTitle}
          chartTitleFontSize={tabState?.chartTitleFontSize}
          chartTitlePosition={tabState?.chartTitlePosition}
          dataLabelsEnabled={tabState?.dataLabelsEnabled}
          dataLabelsPosition={tabState?.dataLabelsPosition}
          dataLabelsFontSize={tabState?.dataLabelsFontSize}
          dataLabelsColor={tabState?.dataLabelsColor}
          dataLabelsBgColor={tabState?.dataLabelsBgColor}
          dataLabelsBold={tabState?.dataLabelsBold}
          dataLabelsItalic={tabState?.dataLabelsItalic}
          legendEnabled={tabState?.legendEnabled}
          legendPosition={tabState?.legendPosition}
          legendFontSize={tabState?.legendFontSize}
          legendSortOrder={tabState?.legendSortOrder}
          colorTheme={tabState?.colorTheme}
          markersEnabled={tabState?.markersEnabled}
          markerSize={tabState?.markerSize}
          markerShapeTheme={tabState?.markerShapeTheme}
          markerFill={tabState?.markerFill}
          chartLineWidth={tabState?.chartLineWidth}
          showLines={tabState?.showLines}
          seriesOverrides={tabState?.seriesOverrides}
          composedDefaultType={tabState?.composedDefaultType}
          composedStacked={tabState?.composedStacked}
          chartBarGap={tabState?.chartBarGap}
          chartBarCategoryGap={tabState?.chartBarCategoryGap}
          xAxisMin={tabState?.xAxisMin}
          xAxisMax={tabState?.xAxisMax}
          yAxisMin={tabState?.yAxisMin}
          yAxisMax={tabState?.yAxisMax}
        />
      </div>
    );
  }

  // Title for table/drilldown
  const tileTitle = tabType === 'drilldown'
    ? (tabState?.drilldownTitle || '')
    : (tabState?.tableTitle || '');
  const tileTitleFontSize = tabType === 'drilldown'
    ? (tabState?.drilldownTitleFontSize || 16)
    : (tabState?.tableTitleFontSize || 16);
  const tileTitlePosition = tabType === 'drilldown'
    ? (tabState?.drilldownTitlePosition || 'center')
    : (tabState?.tableTitlePosition || 'center');

  // Full pivot table view (same as results pane)
  return (
    <div style={{ overflow: 'auto', width: '100%', height: '100%', position: 'relative' }}>
      {tileTitle && (
        <div style={{
          textAlign: tileTitlePosition,
          fontSize: tileTitleFontSize,
          fontWeight: 600,
          color: '#231f20',
          padding: '4px 4px 2px',
        }}>
          {tileTitle}
        </div>
      )}
      <div style={{ fontSize: 11, color: '#6a6a6a', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 0', flexShrink: 0 }}>
        <span>{filteredData.length.toLocaleString()} row{filteredData.length !== 1 ? 's' : ''}{Object.values(tblFilters).some(v => v != null) && ` (filtered from ${allData.length.toLocaleString()})`}</span>
      </div>
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: tableDataFontSize }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                onDoubleClick={() => setSortColumns(prev => cycleSortColumn(prev, col))}
                style={{
                  width: localColWidths[col] || 120, minWidth: 20,
                  textAlign: 'left', fontWeight: 600, fontSize: tableHeaderFontSize,
                  padding: '6px 10px', borderBottom: '2px solid #d0d0d0',
                  background: '#fff', position: 'sticky', top: 0,
                  whiteSpace: 'nowrap', zIndex: filterPopup === col ? 10 : 2,
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}
                    title={columnNameReplacements[col] || prettyColName(col, columnItems, valueItems, valuesAxis)}>
                    {columnNameReplacements[col] || prettyColName(col, columnItems, valueItems, valuesAxis)}
                  </span>
                  {(() => {
                    const si = sortColumns.findIndex(s => s.col === col);
                    return si !== -1 ? <SortIndicator direction={sortColumns[si].direction} order={si + 1} /> : null;
                  })()}
                  <button
                    data-filter-popup="true"
                    onClick={(e) => { e.stopPropagation(); setFilterPopup(filterPopup === col ? null : col); }}
                    style={{
                      background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                      color: tblFilters[col] != null ? '#0777b3' : '#adadad',
                      display: 'flex', flexShrink: 0, borderRadius: 3,
                    }}
                  >
                    <Filter size={11} />
                  </button>
                </div>
                {filterPopup === col && (
                  <ColumnFilterDropdown
                    col={col}
                    pivotData={allData}
                    cascadedData={cascadedData}
                    currentSelection={tblFilters[col] ?? null}
                    applyRef={filterApplyRef}
                    onApply={(selected) => {
                      setTblFilters(p => {
                        const next = { ...p };
                        if (selected === null) delete next[col]; else next[col] = selected;
                        return next;
                      });
                      setFilterPopup(null);
                    }}
                    onCancel={() => setFilterPopup(null)}
                  />
                )}
                {/* Column resize handle */}
                <div
                  onMouseDown={e => { e.preventDefault(); colResizing.current = { col, startX: e.clientX, startW: localColWidths[col] || 120 }; }}
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#0777b3')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.slice(0, 500).map((row, ri) => {
            const rowType = (showSubtotals || showGrandTotals) ? getRowType(row) : 'normal';
            const bgColor = rowType === 'grand_total' ? '#e0ecf4' : rowType === 'subtotal' ? '#eef4f9' : ri % 2 === 0 ? '#fff' : '#fafafa';
            const hoverBg = rowType === 'grand_total' ? '#d4e4f0' : rowType === 'subtotal' ? '#e2edf5' : '#f5f8fa';
            return (
              <tr key={ri}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = bgColor)}
                style={{ background: bgColor, borderBottom: '1px solid #f0f0f0', fontWeight: rowType !== 'normal' ? 600 : 400 }}>
                {columns.map(col => {
                  const val = row[col];
                  const isNum = typeof val === 'number' || typeof val === 'bigint';
                  const colDataFmt = columnDataFormats[col];
                  const display = formatCellValue(val, dataFormat, colDataFmt);
                  const fmt = columnTextFormats[col];
                  const condStyle = getConditionalStyle(row, col, conditionalFormats, colTypes);
                  return (
                    <td key={col} style={{
                      padding: '5px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: localColWidths[col] || 120,
                      textAlign: fmt?.align || (isNum ? 'right' : 'left'),
                      fontVariantNumeric: isNum ? 'tabular-nums' : undefined,
                      ...(fmt ? { fontWeight: fmt.bold ? 600 : undefined, fontStyle: fmt.italic ? 'italic' : undefined, textDecoration: fmt.underline ? 'underline' : undefined, color: fmt.color || undefined, background: fmt.bgColor || undefined } : {}),
                      ...condStyle,
                    }} title={display}>{display}</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Dashboard Canvas ─────────────────────────────────────────── */
function DashboardCanvas({
  dashboardState,
  onUpdateState,
  tabs,
  renderTileContent,
  onTileClick,
  onDeselectAll,
  selectedTileId,
}: {
  dashboardState: DashboardState;
  onUpdateState: (s: DashboardState) => void;
  tabs: { id: string; label: string; type: string; color: string }[];
  renderTileContent: (tabId: string) => React.ReactNode;
  onTileClick: (tabId: string) => void;
  onDeselectAll: () => void;
  selectedTileId: string | null;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragAction, setDragAction] = useState<{
    tileId: string;
    type: 'move' | 'resize';
    startX: number;
    startY: number;
    startTileX: number;
    startTileY: number;
    startTileW: number;
    startTileH: number;
    edge?: string; // for resize: 'nw' | 'ne' | 'sw' | 'se'
  } | null>(null);
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);

  const EDGE_SIZE = 8; // px thickness of the draggable edge border
  const CORNER_SIZE = 14; // px for resize corners
  const MIN_SIZE = 100;

  const getInteractionZoneXY = (clientX: number, clientY: number, rect: DOMRect): 'corner-nw' | 'corner-ne' | 'corner-sw' | 'corner-se' | 'edge' | 'content' => {
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    // Corners first (for resize)
    if (x < CORNER_SIZE && y < CORNER_SIZE) return 'corner-nw';
    if (x > w - CORNER_SIZE && y < CORNER_SIZE) return 'corner-ne';
    if (x < CORNER_SIZE && y > h - CORNER_SIZE) return 'corner-sw';
    if (x > w - CORNER_SIZE && y > h - CORNER_SIZE) return 'corner-se';

    // Edges (for move)
    if (x < EDGE_SIZE || x > w - EDGE_SIZE || y < EDGE_SIZE || y > h - EDGE_SIZE) return 'edge';

    return 'content';
  };

  const getInteractionZone = (e: React.MouseEvent, tile: DashboardTile) => {
    return getInteractionZoneXY(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  const getCursor = (e: React.MouseEvent, tile: DashboardTile): string => {
    const zone = getInteractionZone(e, tile);
    switch (zone) {
      case 'corner-nw': case 'corner-se': return 'nwse-resize';
      case 'corner-ne': case 'corner-sw': return 'nesw-resize';
      case 'edge': return 'move';
      default: return 'default';
    }
  };

  const startDragAction = (clientX: number, clientY: number, tile: DashboardTile, zone: string) => {
    if (zone === 'edge') {
      setDragAction({
        tileId: tile.id, type: 'move',
        startX: clientX, startY: clientY,
        startTileX: tile.x, startTileY: tile.y,
        startTileW: tile.w, startTileH: tile.h,
      });
    } else {
      setDragAction({
        tileId: tile.id, type: 'resize',
        startX: clientX, startY: clientY,
        startTileX: tile.x, startTileY: tile.y,
        startTileW: tile.w, startTileH: tile.h,
        edge: zone.replace('corner-', ''),
      });
    }
  };

  const handleTileMouseDown = (e: React.MouseEvent, tile: DashboardTile) => {
    const zone = getInteractionZone(e, tile);
    if (zone === 'content') return;
    e.preventDefault();
    e.stopPropagation();
    startDragAction(e.clientX, e.clientY, tile, zone);
  };

  const handleTileTouchStart = (e: React.TouchEvent, tile: DashboardTile) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = getInteractionZoneXY(touch.clientX, touch.clientY, rect);
    if (zone === 'content') return;
    e.preventDefault();
    e.stopPropagation();
    startDragAction(touch.clientX, touch.clientY, tile, zone);
  };

  const dashboardStateRef = useRef(dashboardState);
  dashboardStateRef.current = dashboardState;
  const onUpdateStateRef = useRef(onUpdateState);
  onUpdateStateRef.current = onUpdateState;
  const tileElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!dragAction) return;
    const computeTile = (dx: number, dy: number) => {
      let nx = dragAction.startTileX, ny = dragAction.startTileY, nw = dragAction.startTileW, nh = dragAction.startTileH;
      if (dragAction.type === 'move') {
        nx = Math.max(0, dragAction.startTileX + dx);
        ny = Math.max(0, dragAction.startTileY + dy);
      } else {
        const edge = dragAction.edge!;
        if (edge.includes('e')) nw = Math.max(MIN_SIZE, nw + dx);
        if (edge.includes('w')) { nw = Math.max(MIN_SIZE, dragAction.startTileW - dx); nx = dragAction.startTileX + dragAction.startTileW - nw; }
        if (edge.includes('s')) nh = Math.max(MIN_SIZE, nh + dy);
        if (edge.includes('n')) { nh = Math.max(MIN_SIZE, dragAction.startTileH - dy); ny = dragAction.startTileY + dragAction.startTileH - nh; }
        nx = Math.max(0, nx); ny = Math.max(0, ny);
      }
      return { nx, ny, nw, nh };
    };
    const applyToDOM = (dx: number, dy: number) => {
      const { nx, ny, nw, nh } = computeTile(dx, dy);
      const el = tileElRef.current;
      if (el) {
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        el.style.width = nw + 'px';
        el.style.height = nh + 'px';
      }
    };
    const commitState = (dx: number, dy: number) => {
      const currentState = dashboardStateRef.current;
      const updated = currentState.tiles.map(t => {
        if (t.id !== dragAction.tileId) return t;
        const { nx, ny, nw, nh } = computeTile(dx, dy);
        return { ...t, x: nx, y: ny, w: nw, h: nh };
      });
      onUpdateStateRef.current({ ...currentState, tiles: updated });
      tileElRef.current = null;
      setDragAction(null);
    };
    const handleMove = (e: MouseEvent) => applyToDOM(e.clientX - dragAction.startX, e.clientY - dragAction.startY);
    const handleUp = (e: MouseEvent) => commitState(e.clientX - dragAction.startX, e.clientY - dragAction.startY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      applyToDOM(t.clientX - dragAction.startX, t.clientY - dragAction.startY);
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      commitState(t.clientX - dragAction.startX, t.clientY - dragAction.startY);
    };
    // Find the DOM element for the dragged tile
    const canvasEl = canvasRef.current;
    if (canvasEl) {
      tileElRef.current = canvasEl.querySelector(`[data-tile-id="${dragAction.tileId}"]`) as HTMLElement;
    }
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragAction]);

  // Handle drop from tab bar
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const tabId = e.dataTransfer.getData('text/tab-id');
    if (!tabId) return;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab || tab.type === 'dashboard') return;
    // Check if already on canvas
    if (dashboardState.tiles.some(t => t.tabId === tabId)) return;
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const x = canvasRect ? e.clientX - canvasRect.left : 50;
    const y = canvasRect ? e.clientY - canvasRect.top : 50;
    const newTile: DashboardTile = {
      id: `tile-${dashboardState.nextTileId}`,
      tabId,
      x: Math.max(0, x - 200),
      y: Math.max(0, y - 150),
      w: 400,
      h: 300,
    };
    onUpdateState({
      tiles: [...dashboardState.tiles, newTile],
      nextTileId: dashboardState.nextTileId + 1,
    });
  };

  const removeTile = (tileId: string) => {
    onUpdateState({
      ...dashboardState,
      tiles: dashboardState.tiles.filter(t => t.id !== tileId),
    });
  };

  // Handle touch-based tab drop onto dashboard canvas
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const { tabId, x, y } = (e as CustomEvent).detail;
      const tab = tabs.find(t => t.id === tabId);
      if (!tab || tab.type === 'dashboard') return;
      if (dashboardStateRef.current.tiles.some(t => t.tabId === tabId)) return;
      const canvasRect = el.getBoundingClientRect();
      const newTile: DashboardTile = {
        id: `tile-${dashboardStateRef.current.nextTileId}`,
        tabId,
        x: Math.max(0, x - canvasRect.left - 200),
        y: Math.max(0, y - canvasRect.top - 150),
        w: 400,
        h: 300,
      };
      onUpdateStateRef.current({
        tiles: [...dashboardStateRef.current.tiles, newTile],
        nextTileId: dashboardStateRef.current.nextTileId + 1,
      });
    };
    el.addEventListener('touch-tab-drop', handler);
    return () => el.removeEventListener('touch-tab-drop', handler);
  }, [tabs]);

  return (
    <div
      ref={canvasRef}
      data-dashboard-canvas="true"
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      onClick={(e) => { if (e.target === e.currentTarget) onDeselectAll(); }}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'auto',
        background: '#fff',
        minHeight: 0,
      }}
    >
      {dashboardState.tiles.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#adadad', fontSize: 14, pointerEvents: 'none',
        }}>
          Drag a tab here to add it to the dashboard
        </div>
      )}
      {dashboardState.tiles.map(tile => {
        const isHovered = hoveredTile === tile.id;
        const isSelected = selectedTileId === tile.id;
        const tab = tabs.find(t => t.id === tile.tabId);
        return (
          <div
            key={tile.id}
            data-tile-id={tile.id}
            onMouseEnter={() => { if (!dragAction) setHoveredTile(tile.id); }}
            onMouseLeave={() => { if (!dragAction) setHoveredTile(null); }}
            onMouseDown={(e) => handleTileMouseDown(e as any, tile)}
            onTouchStart={(e) => handleTileTouchStart(e as any, tile)}
            onMouseMove={(e) => {
              if (!dragAction) {
                (e.currentTarget as HTMLElement).style.cursor = getCursor(e as any, tile);
              }
            }}
            onClick={(e) => {
              // Only fire tile click if clicking content area
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              if (x > EDGE_SIZE && x < rect.width - EDGE_SIZE && y > EDGE_SIZE && y < rect.height - EDGE_SIZE) {
                onTileClick(tile.tabId);
              }
            }}
            style={{
              position: 'absolute',
              left: tile.x,
              top: tile.y,
              width: tile.w,
              height: tile.h,
              border: (isHovered || isSelected) ? `2px solid ${isSelected ? '#0777b3' : '#bbb'}` : '2px solid transparent',
              borderRadius: 6,
              background: '#fff',
              overflow: 'hidden',
              transition: dragAction ? undefined : 'border-color 0.15s',
              boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.08)' : undefined,
              zIndex: isSelected ? 10 : undefined,
            }}
          >
            {/* Tile label */}
            {(isHovered || isSelected) && (
              <div style={{
                position: 'absolute', top: 2, left: 8, right: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: 10, color: '#6a6a6a', zIndex: 20, pointerEvents: 'auto',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: tab?.color || '#999' }} />
                  {tab?.label || 'Unknown'}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeTile(tile.id); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
                    color: '#6a6a6a', display: 'flex', borderRadius: 3, lineHeight: 1,
                  }}
                  onMouseEnter={(e: any) => { e.currentTarget.style.color = '#bc1200'; }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.color = '#6a6a6a'; }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {/* Content area — takes full tile space */}
            <div style={{
              position: 'absolute',
              inset: EDGE_SIZE,
              overflow: 'hidden',
              pointerEvents: dragAction ? 'none' : 'auto',
            }}>
              {renderTileContent(tile.tabId)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Chat Panel Component ──────────────────────────────────── */
function ChatPanel({
  messages, input, onInputChange, onSend, onClear, onClose,
  width, height, onResizeStart, expandedIds, onToggleExpand, isProcessing,
}: {
  messages: ChatMessage[]; input: string; onInputChange: (v: string) => void;
  onSend: () => void; onClear: () => void; onClose: () => void;
  width: number; height: number; onResizeStart: (e: React.MouseEvent) => void;
  expandedIds: Set<number>; onToggleExpand: (id: number) => void; isProcessing: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  const MSG_PREVIEW_LEN = 300;

  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 0, width, height,
      background: '#fff', border: '1px solid #d0d0d0', borderRadius: '12px 0 0 0',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', zIndex: 9999,
    }}>
      {/* Resize handle - top left corner */}
      <div onMouseDown={onResizeStart} style={{
        position: 'absolute', top: 0, left: 0, width: 18, height: 18, cursor: 'nw-resize', zIndex: 10000,
      }}>
        <svg width={12} height={12} viewBox="0 0 12 12" style={{ position: 'absolute', top: 3, left: 3, opacity: 0.4 }}>
          <line x1="0" y1="12" x2="12" y2="0" stroke="#999" strokeWidth="1.5" />
          <line x1="0" y1="8" x2="8" y2="0" stroke="#999" strokeWidth="1.5" />
          <line x1="0" y1="4" x2="4" y2="0" stroke="#999" strokeWidth="1.5" />
        </svg>
      </div>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #e0e0e0', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>Chat to build visuals</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onClear} title="Clear chat" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: '#6a6a6a', borderRadius: 4, display: 'flex',
          }}><Trash2 size={14} /></button>
          <button onClick={onClose} title="Close" style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: '#6a6a6a', borderRadius: 4, display: 'flex',
          }}><X size={14} /></button>
        </div>
      </div>
      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.length === 0 && (
          <div style={{ color: '#adadad', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
            Ask me to build a pivot table, chart, or dashboard!
          </div>
        )}
        {messages.map(msg => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          const isLong = msg.content.length > MSG_PREVIEW_LEN;
          const isExpanded = expandedIds.has(msg.id);
          const displayContent = isLong && !isExpanded
            ? msg.content.slice(0, MSG_PREVIEW_LEN) + '...'
            : msg.content;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '8px 12px',
                borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: isSystem ? '#fff3cd' : isUser ? '#0777b3' : '#f0f0f0',
                color: isUser ? '#fff' : '#333', fontSize: 12, lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {displayContent}
                {isLong && (
                  <span onClick={() => onToggleExpand(msg.id)} style={{
                    color: isUser ? '#cce5ff' : '#0777b3', cursor: 'pointer', fontSize: 11, marginLeft: 4,
                  }}>
                    {isExpanded ? ' Show less' : ' Show more'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {isProcessing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '8px 12px', borderRadius: '12px 12px 12px 2px',
              background: '#f0f0f0', color: '#6a6a6a', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Input */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid #e0e0e0',
        display: 'flex', gap: 8, flexShrink: 0, alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="I want to build a chart that looks at air quality over time (pm25) by world region"
          rows={2}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            border: '1px solid #d0d0d0', fontSize: 12, outline: 'none', fontFamily: 'inherit',
            resize: 'none', overflowY: 'auto',
          }}
          disabled={isProcessing}
        />
        <button
          onClick={onSend}
          disabled={isProcessing || !input.trim()}
          style={{
            background: '#0777b3', border: 'none', borderRadius: 8,
            padding: '8px 12px', cursor: isProcessing || !input.trim() ? 'default' : 'pointer',
            color: '#fff', display: 'flex', alignItems: 'center',
            opacity: isProcessing || !input.trim() ? 0.5 : 1,
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

export default function PivotTableDive() {
  // ── State ──────────────────────────────────────────────────────
  const [selected, setSelected] = useState<{
    db: string;
    schema: string;
    table: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [filterItems, setFilterItems] = useState<QuadItem[]>([]);
  const [columnItems, setColumnItems] = useState<DimItem[]>([]);
  const [rowItems, setRowItems] = useState<DimItem[]>([]);
  const [valueItems, setValueItems] = useState<QuadItem[]>([]);

  const [customSqlExpanded, setCustomSqlExpanded] = useState(false);
  const [customSqlText, setCustomSqlText] = useState("");
  const [committedCustomSql, setCommittedCustomSql] = useState("");

  const [showSubtotals, setShowSubtotals] = useState(false);
  const [showGrandTotals, setShowGrandTotals] = useState(false);
  const [valuesAxis, setValuesAxis] = useState<'columns' | 'rows' | null>(null);

  const [chartType, setChartType] = useState<ChartTypeId>('table');
  const [showChartPicker, setShowChartPicker] = useState(false);

  // ── Unified tab state ─────────────────────────────────────────
  const drilldownCounter = useRef(0);
  const drillCounters = useRef<Record<string, number>>({});
  const [tabs, setTabs] = useState<{ id: string; label: string; type: 'pivot' | 'chart' | 'drilldown' | 'dashboard'; parentId?: string; color: string; sql?: string; drilldownTableId?: number }[]>([
    { id: 'pivot-1', label: 'Pivot 1', type: 'pivot', color: CHART_PALETTE[0] },
  ]);
  const [activeTabId, setActiveTabId] = useState('pivot-1');
  const savedTabStates = useRef<Record<string, any>>({});
  const pivotTabCounter = useRef({ pivot: 1, chart: 0, dashboard: 0 });
  const tabDragRef = useRef<{ dragIdx: number } | null>(null);
  // Dashboard state per dashboard tab
  const dashboardStates = useRef<Record<string, DashboardState>>({});
  const dashboardTileCounter = useRef(0);
  const [dashboardSelectedTabId, setDashboardSelectedTabId] = useState<string | null>(null);
  const [dashboardRenderKey, setDashboardRenderKey] = useState(0);

  // Derived compatibility values
  const activeTabInfo = tabs.find(t => t.id === activeTabId);
  const isViewingDashboard = activeTabInfo?.type === 'dashboard';
  const currentPivotId = activeTabInfo?.type === 'drilldown' ? activeTabInfo.parentId! : activeTabId;
  const isViewingDrilldown = activeTabInfo?.type === 'drilldown';
  const drilldownTabs = useMemo(() =>
    tabs.filter(t => t.type === 'drilldown').map(t => ({ id: t.drilldownTableId!, label: t.label, sql: t.sql! })),
    [tabs]
  );
  const activeTab: 'pivot' | number = isViewingDrilldown ? activeTabInfo!.drilldownTableId! : 'pivot';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const [leftWidth, setLeftWidth] = useState(380);
  const [sectionFlex, setSectionFlex] = useState([3, 2, 4]);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    sourceQuad: string;
    sourceIdx: number;
    text: string;
  } | null>(null);
  const dragRef = useRef<typeof dragState>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dropOkRef = useRef(false);
  // Phantom: a ghost chip rendered at a position in a target quadrant
  // without touching the actual state arrays.
  const [phantom, setPhantom] = useState<{
    quad: string;
    idx: number;
    colName: string;
  } | null>(null);
  const phantomRef = useRef<typeof phantom>(null);

  // ── Touch drag support (mobile) ─────────────────────────────
  const touchDragRef = useRef<{
    type: 'chip' | 'tab';
    sourceQuad?: string;
    sourceIdx?: number;
    text: string;
    tabIdx?: number;
    tabId?: string;
    startX: number;
    startY: number;
    active: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const touchGhostRef = useRef<HTMLDivElement>(null);
  const showTouchGhost = (x: number, y: number, text: string) => {
    const el = touchGhostRef.current;
    if (!el) return;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.display = 'block';
  };
  const hideTouchGhost = () => {
    const el = touchGhostRef.current;
    if (el) el.style.display = 'none';
  };

  const [tblFilters, setTblFilters] = useState<Record<string, Set<string>>>({});
  const [filterPopup, setFilterPopup] = useState<string | null>(null);
  const [aggMenuId, setAggMenuId] = useState<string | null>(null);
  const [aggMenuPos, setAggMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [dateMenuId, setDateMenuId] = useState<string | null>(null);
  const [dateMenuPos, setDateMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [pivotSortColumns, setPivotSortColumns] = useState<SortColumn[]>([]);
  const [pivotRowLimit, setPivotRowLimit] = useState(100);
  const [pivotPage, setPivotPage] = useState(0);
  const colWidthsRef = useRef(colWidths);
  colWidthsRef.current = colWidths;

  const [filterDropdownId, setFilterDropdownId] = useState<string | null>(null);
  const [filterMetaMap, setFilterMetaMap] = useState<Record<string, FilterMeta>>({});
  const pendingFilterOpenRef = useRef<string | null>(null);

  // Left panel tab
  const [leftPanelTab, setLeftPanelTab] = useState<'setup' | 'format'>('setup');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // ── Format settings ──────────────────────────────────────────
  // Shared
  const [maxRowCount, setMaxRowCount] = useState(1000000);

  // Pivot Table format
  const [tableTitle, setTableTitle] = useState('');
  const [tableTitleFontSize, setTableTitleFontSize] = useState(16);
  const [tableTitlePosition, setTableTitlePosition] = useState<'left' | 'center' | 'right'>('center');
  const [columnNameReplacements, setColumnNameReplacements] = useState<Record<string, string>>({});
  const [tableHeaderFontSize, setTableHeaderFontSize] = useState(12);
  const [tableDataFontSize, setTableDataFontSize] = useState(12);
  const [columnTextFormats, setColumnTextFormats] = useState<Record<string, { bold?: boolean; italic?: boolean; underline?: boolean; color?: string; bgColor?: string; align?: 'left' | 'center' | 'right'; numberFormat?: string }>>({});
  const [colWidthMode, setColWidthMode] = useState<ColWidthMode>('name');
  const [colWidthMaxData, setColWidthMaxData] = useState(300);
  const [colWidthFixed, setColWidthFixed] = useState(150);
  const [colWidthOverrides, setColWidthOverrides] = useState<Record<string, number>>({});

  // Conditional formatting (shared between pivot table and drilldown)
  const [conditionalFormats, setConditionalFormats] = useState<ConditionalFormatRule[]>([]);

  // Pivot Table data formatting
  const [dataFormat, setDataFormat] = useState<DataFormatSettings>({ ...DEFAULT_DATA_FORMAT });
  const [columnDataFormats, setColumnDataFormats] = useState<Record<string, DataFormatSettings>>({});

  // Drilldown format
  const [drilldownTitle, setDrilldownTitle] = useState('');
  const [drilldownTitleFontSize, setDrilldownTitleFontSize] = useState(16);
  const [drilldownTitlePosition, setDrilldownTitlePosition] = useState<'left' | 'center' | 'right'>('center');
  const [drilldownHeaderFontSize, setDrilldownHeaderFontSize] = useState(12);
  const [drilldownDataFontSize, setDrilldownDataFontSize] = useState(12);
  const [drilldownColumnTextFormats, setDrilldownColumnTextFormats] = useState<Record<string, { bold?: boolean; italic?: boolean; underline?: boolean; color?: string; bgColor?: string; align?: 'left' | 'center' | 'right'; numberFormat?: string }>>({});
  const [drilldownConditionalFormats, setDrilldownConditionalFormats] = useState<ConditionalFormatRule[]>([]);

  // Drilldown data formatting
  const [drilldownDataFormat, setDrilldownDataFormat] = useState<DataFormatSettings>({ ...DEFAULT_DATA_FORMAT });
  const [drilldownColumnDataFormats, setDrilldownColumnDataFormats] = useState<Record<string, DataFormatSettings>>({});

  const [drilldownColWidthMode, setDrilldownColWidthMode] = useState<ColWidthMode>('name');
  const [drilldownColWidthMaxData, setDrilldownColWidthMaxData] = useState(300);
  const [drilldownColWidthFixed, setDrilldownColWidthFixed] = useState(150);
  const [drilldownColWidthOverrides, setDrilldownColWidthOverrides] = useState<Record<string, number>>({});
  const [drilldownRowLimit, setDrilldownRowLimit] = useState(100);

  // Chart format
  const [chartTitle, setChartTitle] = useState('');
  const [chartTitleFontSize, setChartTitleFontSize] = useState(16);
  const [chartTitlePosition, setChartTitlePosition] = useState<'left' | 'center' | 'right'>('center');
  const [dataLabelsEnabled, setDataLabelsEnabled] = useState(false);
  const [dataLabelsPosition, setDataLabelsPosition] = useState<'above' | 'on' | 'below'>('above');
  const [dataLabelsFontSize, setDataLabelsFontSize] = useState(11);
  const [dataLabelsColor, setDataLabelsColor] = useState('#231f20');
  const [dataLabelsBgColor, setDataLabelsBgColor] = useState('');
  const [dataLabelsBold, setDataLabelsBold] = useState(false);
  const [dataLabelsItalic, setDataLabelsItalic] = useState(false);
  const [legendEnabled, setLegendEnabled] = useState(true);
  const [legendPosition, setLegendPosition] = useState<'bottom' | 'left' | 'right' | 'top'>('bottom');
  const [legendFontSize, setLegendFontSize] = useState(13);
  const [colorTheme, setColorTheme] = useState<string>('default');
  const [markersEnabled, setMarkersEnabled] = useState(true);
  const [markerSize, setMarkerSize] = useState(4);
  const [markerShapeTheme, setMarkerShapeTheme] = useState<'circles' | 'triangles' | 'squares' | 'diamonds' | 'mixed'>('circles');
  const [markerFill, setMarkerFill] = useState<'solid' | 'border'>('solid');
  const [chartLineWidth, setChartLineWidth] = useState(2);
  const [showLines, setShowLines] = useState(true);
  const [seriesOverrides, setSeriesOverrides] = useState<Record<string, { color?: string; lineWidth?: number; barWidth?: number; areaOpacity?: number; seriesChartType?: 'bar' | 'line' | 'area'; showLines?: boolean; markersEnabled?: boolean; markerSize?: number; markerShapeTheme?: 'circles' | 'triangles' | 'squares' | 'diamonds' | 'mixed'; markerFill?: 'solid' | 'border' }>>({});
  const [bigNumberFontSize, setBigNumberFontSize] = useState(48);
  const [bigNumberAbbreviate, setBigNumberAbbreviate] = useState(true);
  const [bigNumberDecimalPlaces, setBigNumberDecimalPlaces] = useState(0);
  const [bigNumberTitle, setBigNumberTitle] = useState('');
  const [bigNumberTitlePosition, setBigNumberTitlePosition] = useState<'above' | 'below'>('above');
  const [bigNumberTitleFontSize, setBigNumberTitleFontSize] = useState(14);
  const [composedDefaultType, setComposedDefaultType] = useState<'bar' | 'line' | 'area'>('line');
  const [composedStacked, setComposedStacked] = useState(false);
  const [chartBarGap, setChartBarGap] = useState(4);
  const [chartBarCategoryGap, setChartBarCategoryGap] = useState(20);
  const [xAxisMin, setXAxisMin] = useState<string>('');
  const [xAxisMax, setXAxisMax] = useState<string>('');
  const [yAxisMin, setYAxisMin] = useState<string>('');
  const [yAxisMax, setYAxisMax] = useState<string>('');
  const [legendSortOrder, setLegendSortOrder] = useState<'a-z' | 'z-a' | 'biggest-smallest' | 'smallest-biggest'>('biggest-smallest');

  // ── Chat panel state (persists across tab switches) ──────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatPanelWidth, setChatPanelWidth] = useState(() => Math.floor(window.innerWidth / 3));
  const [chatPanelHeight, setChatPanelHeight] = useState(() => Math.floor(window.innerHeight / 2));
  const [chatExpandedIds, setChatExpandedIds] = useState<Set<number>>(new Set());
  const chatMsgIdRef = useRef(0);
  const chatResizing = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // LLM multi-step flow state
  const [chatProcessing, setChatProcessing] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);

  const addChatMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    const id = ++chatMsgIdRef.current;
    setChatMessages(prev => [...prev, { id, role, content }]);
    return id;
  }, []);

  // ── Tab management helpers ─────────────────────────────────────
  const collectTabState = () => ({
    filterItems, columnItems, rowItems, valueItems,
    customSqlExpanded, customSqlText, committedCustomSql,
    showSubtotals, showGrandTotals, valuesAxis,
    chartType,
    pivotSortColumns, pivotRowLimit, pivotPage,
    leftPanelTab,
    maxRowCount,
    tableTitle, tableTitleFontSize, tableTitlePosition,
    columnNameReplacements, tableHeaderFontSize, tableDataFontSize,
    columnTextFormats, colWidthMode, colWidthMaxData, colWidthFixed, colWidthOverrides,
    conditionalFormats, dataFormat, columnDataFormats,
    drilldownTitle, drilldownTitleFontSize, drilldownTitlePosition,
    drilldownHeaderFontSize, drilldownDataFontSize,
    drilldownColumnTextFormats, drilldownConditionalFormats,
    drilldownDataFormat, drilldownColumnDataFormats,
    drilldownColWidthMode, drilldownColWidthMaxData, drilldownColWidthFixed, drilldownColWidthOverrides,
    drilldownRowLimit,
    chartTitle, chartTitleFontSize, chartTitlePosition,
    dataLabelsEnabled, dataLabelsPosition, dataLabelsFontSize, dataLabelsColor, dataLabelsBgColor, dataLabelsBold, dataLabelsItalic,
    legendEnabled, legendPosition, legendFontSize,
    colorTheme,
    markersEnabled, markerSize, markerShapeTheme, markerFill,
    chartLineWidth, showLines,
    seriesOverrides,
    composedDefaultType, composedStacked,
    chartBarGap, chartBarCategoryGap,
    xAxisMin, xAxisMax, yAxisMin, yAxisMax,
    legendSortOrder,
    bigNumberFontSize, bigNumberAbbreviate, bigNumberDecimalPlaces, bigNumberTitle, bigNumberTitlePosition, bigNumberTitleFontSize,
    colWidths, tblFilters,
  });

  const applyTabState = (s: any) => {
    setFilterItems(s.filterItems);
    setColumnItems(s.columnItems);
    setRowItems(s.rowItems);
    setValueItems(s.valueItems);
    setCustomSqlExpanded(s.customSqlExpanded);
    setCustomSqlText(s.customSqlText);
    setCommittedCustomSql(s.committedCustomSql);
    setShowSubtotals(s.showSubtotals);
    setShowGrandTotals(s.showGrandTotals);
    setValuesAxis(s.valuesAxis);
    setChartType(s.chartType);
    setPivotSortColumns(s.pivotSortColumns);
    setPivotRowLimit(s.pivotRowLimit);
    setPivotPage(s.pivotPage);
    setLeftPanelTab(s.leftPanelTab);
    setMaxRowCount(s.maxRowCount);
    setTableTitle(s.tableTitle ?? '');
    setTableTitleFontSize(s.tableTitleFontSize ?? 16);
    setTableTitlePosition(s.tableTitlePosition ?? 'center');
    setColumnNameReplacements(s.columnNameReplacements);
    setTableHeaderFontSize(s.tableHeaderFontSize);
    setTableDataFontSize(s.tableDataFontSize);
    setColumnTextFormats(s.columnTextFormats);
    setColWidthMode(s.colWidthMode);
    setColWidthMaxData(s.colWidthMaxData);
    setColWidthFixed(s.colWidthFixed);
    setColWidthOverrides(s.colWidthOverrides);
    setConditionalFormats(s.conditionalFormats);
    setDataFormat(s.dataFormat);
    setColumnDataFormats(s.columnDataFormats);
    setDrilldownTitle(s.drilldownTitle ?? '');
    setDrilldownTitleFontSize(s.drilldownTitleFontSize ?? 16);
    setDrilldownTitlePosition(s.drilldownTitlePosition ?? 'center');
    setDrilldownHeaderFontSize(s.drilldownHeaderFontSize);
    setDrilldownDataFontSize(s.drilldownDataFontSize);
    setDrilldownColumnTextFormats(s.drilldownColumnTextFormats);
    setDrilldownConditionalFormats(s.drilldownConditionalFormats);
    setDrilldownDataFormat(s.drilldownDataFormat);
    setDrilldownColumnDataFormats(s.drilldownColumnDataFormats);
    setDrilldownColWidthMode(s.drilldownColWidthMode);
    setDrilldownColWidthMaxData(s.drilldownColWidthMaxData);
    setDrilldownColWidthFixed(s.drilldownColWidthFixed);
    setDrilldownColWidthOverrides(s.drilldownColWidthOverrides);
    setDrilldownRowLimit(s.drilldownRowLimit);
    setChartTitle(s.chartTitle);
    setChartTitleFontSize(s.chartTitleFontSize);
    setChartTitlePosition(s.chartTitlePosition);
    setDataLabelsEnabled(s.dataLabelsEnabled);
    setDataLabelsPosition(s.dataLabelsPosition);
    setDataLabelsFontSize(s.dataLabelsFontSize);
    setDataLabelsColor(s.dataLabelsColor);
    setDataLabelsBgColor(s.dataLabelsBgColor);
    setDataLabelsBold(s.dataLabelsBold);
    setDataLabelsItalic(s.dataLabelsItalic);
    setLegendEnabled(s.legendEnabled);
    setLegendPosition(s.legendPosition);
    setLegendFontSize(s.legendFontSize);
    setColorTheme(s.colorTheme);
    setMarkersEnabled(s.markersEnabled);
    setMarkerSize(s.markerSize);
    setMarkerShapeTheme(s.markerShapeTheme);
    setMarkerFill(s.markerFill);
    setChartLineWidth(s.chartLineWidth);
    setShowLines(s.showLines);
    setSeriesOverrides(s.seriesOverrides);
    setComposedDefaultType(s.composedDefaultType);
    setComposedStacked(s.composedStacked);
    setChartBarGap(s.chartBarGap);
    setChartBarCategoryGap(s.chartBarCategoryGap);
    setXAxisMin(s.xAxisMin);
    setXAxisMax(s.xAxisMax);
    setYAxisMin(s.yAxisMin);
    setYAxisMax(s.yAxisMax);
    setLegendSortOrder(s.legendSortOrder ?? 'biggest-smallest');
    setBigNumberFontSize(s.bigNumberFontSize ?? 48);
    setBigNumberAbbreviate(s.bigNumberAbbreviate ?? true);
    setBigNumberDecimalPlaces(s.bigNumberDecimalPlaces ?? 0);
    setBigNumberTitle(s.bigNumberTitle ?? '');
    setBigNumberTitlePosition(s.bigNumberTitlePosition ?? 'above');
    setBigNumberTitleFontSize(s.bigNumberTitleFontSize ?? 14);
    setColWidths(s.colWidths);
    setTblFilters(s.tblFilters);
    // Reset transient UI state
    setEditingId(null);
    setEditText('');
    setShowChartPicker(false);
    setAggMenuId(null);
    setDateMenuId(null);
    setFilterPopup(null);
    setFilterDropdownId(null);
  };

  const defaultTabState = (type: 'pivot' | 'chart'): any => ({
    filterItems: [], columnItems: [], rowItems: [], valueItems: [],
    customSqlExpanded: false, customSqlText: '', committedCustomSql: '',
    showSubtotals: false, showGrandTotals: false, valuesAxis: null,
    chartType: (type === 'chart' ? 'bar' : 'table') as ChartTypeId,
    pivotSortColumns: [], pivotRowLimit: 100, pivotPage: 0,
    leftPanelTab: 'setup' as const,
    maxRowCount: 10000,
    tableTitle: '', tableTitleFontSize: 16, tableTitlePosition: 'center' as const,
    columnNameReplacements: {}, tableHeaderFontSize: 12, tableDataFontSize: 12,
    columnTextFormats: {}, colWidthMode: 'name' as ColWidthMode, colWidthMaxData: 300, colWidthFixed: 150, colWidthOverrides: {},
    conditionalFormats: [], dataFormat: { ...DEFAULT_DATA_FORMAT }, columnDataFormats: {},
    drilldownTitle: '', drilldownTitleFontSize: 16, drilldownTitlePosition: 'center' as const,
    drilldownHeaderFontSize: 12, drilldownDataFontSize: 12,
    drilldownColumnTextFormats: {}, drilldownConditionalFormats: [],
    drilldownDataFormat: { ...DEFAULT_DATA_FORMAT }, drilldownColumnDataFormats: {},
    drilldownColWidthMode: 'name' as ColWidthMode, drilldownColWidthMaxData: 300, drilldownColWidthFixed: 150, drilldownColWidthOverrides: {},
    drilldownRowLimit: 100,
    chartTitle: '', chartTitleFontSize: 16, chartTitlePosition: 'center' as const,
    dataLabelsEnabled: false, dataLabelsPosition: 'above' as const, dataLabelsFontSize: 11, dataLabelsColor: '#231f20', dataLabelsBgColor: '', dataLabelsBold: false, dataLabelsItalic: false,
    legendEnabled: true, legendPosition: 'bottom' as const, legendFontSize: 13,
    colorTheme: 'default',
    markersEnabled: true, markerSize: 4, markerShapeTheme: 'circles' as const, markerFill: 'solid' as const,
    chartLineWidth: 2, showLines: true,
    seriesOverrides: {},
    composedDefaultType: 'line' as const, composedStacked: false,
    chartBarGap: 4, chartBarCategoryGap: 20,
    xAxisMin: '', xAxisMax: '', yAxisMin: '', yAxisMax: '',
    legendSortOrder: 'biggest-smallest' as const,
    bigNumberFontSize: 48, bigNumberAbbreviate: true, bigNumberDecimalPlaces: 0,
    bigNumberTitle: '', bigNumberTitlePosition: 'above' as const, bigNumberTitleFontSize: 14,
    colWidths: {}, tblFilters: {},
  });

  const switchToTab = (targetId: string) => {
    if (targetId === activeTabId) return;
    const targetTab = tabs.find(t => t.id === targetId);
    if (!targetTab) return;
    // Save selected tile's live state back before leaving dashboard
    if (isViewingDashboard && dashboardSelectedTabId) {
      savedTabStates.current[dashboardSelectedTabId] = collectTabState();
    }
    if (isViewingDashboard) setDashboardSelectedTabId(null);
    // Dashboard tabs don't have pivot state to save/load
    if (targetTab.type === 'dashboard') {
      // Save current pivot state before switching away
      if (!isViewingDashboard) {
        savedTabStates.current[currentPivotId] = collectTabState();
      }
      setActiveTabId(targetId);
      return;
    }
    const targetPivotId = targetTab.type === 'drilldown' ? targetTab.parentId! : targetTab.id;
    // Save/load only when the pivot context changes
    if (targetPivotId !== currentPivotId && !isViewingDashboard) {
      savedTabStates.current[currentPivotId] = collectTabState();
    }
    if (targetPivotId !== currentPivotId || isViewingDashboard) {
      const st = savedTabStates.current[targetPivotId];
      if (st) applyTabState(st);
    }
    setActiveTabId(targetId);
  };

  const createPivotTab = (type: 'pivot' | 'chart') => {
    if (!isViewingDashboard) savedTabStates.current[currentPivotId] = collectTabState();
    pivotTabCounter.current[type] += 1;
    const n = pivotTabCounter.current[type];
    const id = `${type}-${n}`;
    const label = type === 'pivot' ? `Pivot ${n}` : `Chart ${n}`;
    const pivotCount = tabs.filter(t => t.type !== 'drilldown').length;
    const color = CHART_PALETTE[pivotCount % CHART_PALETTE.length];
    setTabs(prev => [...prev, { id, label, type, color }]);
    applyTabState(defaultTabState(type));
    setActiveTabId(id);
  };

  const createDashboardTab = () => {
    if (!isViewingDashboard) {
      savedTabStates.current[currentPivotId] = collectTabState();
    }
    pivotTabCounter.current.dashboard += 1;
    const n = pivotTabCounter.current.dashboard;
    const id = `dashboard-${n}`;
    const label = `Dashboard ${n}`;
    const color = '#638CAD';
    dashboardStates.current[id] = { tiles: [], nextTileId: 1 };
    setTabs(prev => [...prev, { id, label, type: 'dashboard' as const, color }]);
    setActiveTabId(id);
  };

  const closeTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    if (tab.type === 'drilldown') {
      setTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTabId === tabId) setActiveTabId(tab.parentId!);
      return;
    }
    if (tab.type === 'dashboard') {
      delete dashboardStates.current[tabId];
      setTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTabId === tabId) {
        const remaining = tabs.filter(t => t.id !== tabId && t.type !== 'drilldown');
        const newActive = remaining[0];
        if (newActive) {
          if (newActive.type !== 'dashboard') {
            const st = savedTabStates.current[newActive.id];
            if (st) applyTabState(st);
          }
          setActiveTabId(newActive.id);
        }
      }
      return;
    }
    // Pivot/chart tab: don't close the last one
    if (tabs.filter(t => t.type !== 'drilldown' && t.type !== 'dashboard').length <= 1) return;
    delete savedTabStates.current[tabId];
    const childIds = new Set(tabs.filter(t => t.parentId === tabId).map(t => t.id));
    setTabs(prev => {
      const next = prev.filter(t => t.id !== tabId && t.parentId !== tabId);
      if (activeTabId === tabId || childIds.has(activeTabId)) {
        const pivots = prev.filter(t => t.type !== 'drilldown' && t.type !== 'dashboard');
        const idx = pivots.findIndex(t => t.id === tabId);
        const remaining = next.filter(t => t.type !== 'drilldown' && t.type !== 'dashboard');
        const newActive = remaining[Math.min(idx, remaining.length - 1)];
        if (newActive) {
          const st = savedTabStates.current[newActive.id];
          if (st) applyTabState(st);
          setActiveTabId(newActive.id);
        }
      }
      return next;
    });
  };

  const nextIdRef = useRef(1);
  const getId = () => `q${nextIdRef.current++}`;

  // ── Keep dashboard tile + original tab in sync with live edits ──
  // When a dashboard tile is selected, write live state to savedTabStates
  // on every render so both the tile and the original tab stay current.
  if (isViewingDashboard && dashboardSelectedTabId) {
    savedTabStates.current[dashboardSelectedTabId] = collectTabState();
  }

  // Auto-show/hide values axis indicator based on value count
  useEffect(() => {
    if (valueItems.length >= 2 && valuesAxis === null) {
      setValuesAxis('columns');
    } else if (valueItems.length < 2 && valuesAxis !== null) {
      setValuesAxis(null);
    }
  }, [valueItems.length, valuesAxis]);

  // Auto-open filter dropdown after a new filter is added
  useEffect(() => {
    if (pendingFilterOpenRef.current) {
      const id = pendingFilterOpenRef.current;
      pendingFilterOpenRef.current = null;
      setFilterDropdownId(id);
    }
  }, [filterItems]);

  const runCustomSql = useCallback(() => {
    if (customSqlText.trim()) setCommittedCustomSql(customSqlText);
  }, [customSqlText]);

  const isCustomSqlActive = customSqlExpanded && committedCustomSql.trim().length > 0;
  const hasSource = !!selected || isCustomSqlActive;

  // ── Panel resize ───────────────────────────────────────────────
  const panelResizing = useRef(false);
  const colResizing = useRef<{
    col: string;
    startX: number;
    startW: number;
  } | null>(null);
  const hResizing = useRef<{ divider: number; startY: number; startFlex: number[] } | null>(null);
  const rafId = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (panelResizing.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          setLeftWidth(Math.max(250, Math.min(700, e.clientX)));
        });
        return;
      }
      if (colResizing.current) {
        const { col, startX, startW } = colResizing.current;
        const newW = Math.max(20, startW + e.clientX - startX);
        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          setColWidths((prev) => ({ ...prev, [col]: newW }));
        });
      }
      if (hResizing.current && leftPanelRef.current) {
        const { divider, startY, startFlex } = hResizing.current;
        const panelHeight = leftPanelRef.current.getBoundingClientRect().height;
        const totalFlex = startFlex[0] + startFlex[1] + startFlex[2];
        const deltaFlex = ((e.clientY - startY) / panelHeight) * totalFlex;
        const newFlex = [...startFlex];
        if (divider === 0) {
          newFlex[0] = Math.max(0.5, startFlex[0] + deltaFlex);
          newFlex[1] = Math.max(0.5, startFlex[1] - deltaFlex);
        } else {
          newFlex[1] = Math.max(0.5, startFlex[1] + deltaFlex);
          newFlex[2] = Math.max(0.5, startFlex[2] - deltaFlex);
        }
        setSectionFlex(newFlex);
      }
      if (chatResizing.current) {
        const { startX, startY, startW, startH } = chatResizing.current;
        const newW = Math.max(280, Math.min(window.innerWidth - 40, startW + (startX - e.clientX)));
        const newH = Math.max(200, Math.min(window.innerHeight - 40, startH + (startY - e.clientY)));
        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          setChatPanelWidth(newW);
          setChatPanelHeight(newH);
        });
      }
    };
    const onUp = () => {
      cancelAnimationFrame(rafId.current);
      if (colResizing.current) {
        const { col } = colResizing.current;
        const finalWidth = colWidthsRef.current[col];
        if (finalWidth) setColWidthOverrides(prev => ({ ...prev, [col]: finalWidth }));
      }
      panelResizing.current = false;
      colResizing.current = null;
      hResizing.current = null;
      chatResizing.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Close filter popup on outside click (applies current selections)
  const filterApplyRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!filterPopup) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-filter-popup]")) {
        if (filterApplyRef.current) filterApplyRef.current();
        else setFilterPopup(null);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [filterPopup]);

  // Close filter quadrant dropdown on outside click (applies current selections)
  const filterQuadApplyRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!filterDropdownId) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-filter-quad-popup]")) {
        if (filterQuadApplyRef.current) filterQuadApplyRef.current();
        else setFilterDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [filterDropdownId]);

  // Close agg menu on outside click
  useEffect(() => {
    if (!aggMenuId) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-agg-menu]")) {
        setAggMenuId(null);
        setAggMenuPos(null);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [aggMenuId]);

  // Close date granularity menu on outside click
  useEffect(() => {
    if (!dateMenuId) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-date-menu]")) {
        setDateMenuId(null);
        setDateMenuPos(null);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [dateMenuId]);

  // ── SQL Queries ────────────────────────────────────────────────
  const tablesQ = useSQLQuery(
    `SELECT database_name, schema_name, table_name FROM duckdb_tables() ORDER BY 1, 2, 3`
  );

  // Temp macro test — runs right after tablesQ, before pivot_table
  const tempMacroQ = useSQLQuery(`
    CREATE OR REPLACE TEMP MACRO dq(my_varchar) AS  ((('"' || "replace"(my_varchar, '"', '""')) || '"'));
    CREATE OR REPLACE TEMP MACRO nq(my_varchar) AS  ("replace"(my_varchar, ';', 'No semicolons are permitted here'));
    CREATE OR REPLACE TEMP MACRO sq(my_varchar) AS  ((('''' || "replace"(my_varchar, '''', '''''')) || ''''));
    CREATE OR REPLACE TEMP MACRO nq_list(my_list) AS  (list_transform(my_list, (i -> nq(i))));
    CREATE OR REPLACE TEMP MACRO sq_list(my_list) AS  (list_transform(my_list, (i -> sq(i))));
    CREATE OR REPLACE TEMP MACRO dq_list(my_list) AS  (list_transform(my_list, (i -> dq(i))));
    CREATE OR REPLACE TEMP MACRO dq_concat(my_list,separator) AS  (list_reduce(dq_list(my_list), (main."row"(x, y) -> ((x || separator) || y))));
    CREATE OR REPLACE TEMP MACRO nq_concat(my_list,separator) AS  (CASE  WHEN ((length(my_list) = 0)) THEN (NULL) ELSE list_reduce(nq_list(my_list), (main."row"(x, y) -> ((x || separator) || y))) END);
    CREATE OR REPLACE TEMP MACRO sq_concat(my_list,separator) AS  (list_reduce(sq_list(my_list), (main."row"(x, y) -> ((x || separator) || y))));
    CREATE OR REPLACE TEMP MACRO replace_zzz(rows,extra_cols) AS  ((((((((('SELECT 
                replace(
                    replace(
                        COLUMNS(c -> list_contains([' || sq_concat("rows", ', ')) || ', ') || sq_concat(extra_cols, ', ')) || '], c))::varchar,
                        ''zzzSubtotal'',
                        ''Subtotal''
                        ),
                    ''zzzGrand Total'',
                    ''Grand Total''),
                columns(c -> NOT list_contains([') || sq_concat("rows", ', ')) || '], c) AND c NOT IN (') || sq_concat(extra_cols, ', ')) || '))
            '));
    CREATE OR REPLACE TEMP MACRO totals_list(rows,subtotals,grand_totals) AS  (main.list_apply("range"(CASE  WHEN (subtotals) THEN (0) ELSE (length("rows") - 1) END, CASE  WHEN (grand_totals) THEN (length("rows")) ELSE (length("rows") - 1) END), (lambda i: CASE  WHEN ((i = (length("rows") - 1))) THEN (nq_concat(list_transform("rows"[:-((i + 1)):-1], (j -> ('''zzzGrand Total'' as ' || dq(j)))), ', ')) ELSE nq_concat(list_transform("rows"[:-((i + 1)):-1], (j -> ('''zzzSubtotal'' as ' || dq(j)))), ', ') END)));
    CREATE OR REPLACE TEMP MACRO columns_values_axis_rows(table_names,"values",rows,columns,column_names,filters,values_axis,subtotals,grand_totals) AS  (((('WITH raw_pivot AS ( ' || nq_concat(list_transform("values", (i -> (((((((('
                        FROM (
                            PIVOT (
                                ' || CASE  WHEN (((subtotals OR grand_totals) AND (length("rows") > 0))) THEN (nq_concat((main.list_value(((((('FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
                                        SELECT *, 1 as dummy_column, ') || sq(i)) || ' AS value_names 

                                        -- FILTERS
                                        ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), ''))) || list_transform(totals_list("rows", subtotals := subtotals, grand_totals := grand_totals), (k -> ((((((('FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
                                            SELECT * replace(') || k) || '), 1 as dummy_column, ') || sq(i)) || ' AS value_names 

                                            -- FILTERS
                                            ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), ''))))), ' 
                                        UNION ALL BY NAME 
                                        ')) ELSE ((((('
                                    FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
                                    SELECT *, 1 as dummy_column, ') || sq(i)) || ' AS value_names 

                                    -- FILTERS
                                    ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), '')) END) || '
                            )
                            -- COLUMNS
                            -- When pivoting, do not use all combinations of values in the columns parameter,
                            -- only use the combinations that actually exist in the data. 
                            -- This is achieved by only pivoting ON one expression (that has all columns concatenated together)
                            ON ') || dq_concat("columns", ' || ''|||'' || ')) || ' IN (' || sq_concat(column_names, ', ') || ')
                            
                            -- VALUES
                            -- Each PIVOT will use a single value metric
                            USING ') || nq(i)) || '

                            -- ROWS
                            GROUP BY dummy_column') || COALESCE((', ' || dq_concat("rows", ', ')), '')) || ', value_names 
                        ) 
                        '))), ' UNION ALL BY NAME ')) || '
            ), ordered_pivot AS (FROM raw_pivot ORDER BY ALL NULLS FIRST LIMIT 10000000000)
            FROM ordered_pivot 
            ') || CASE  WHEN (((subtotals OR grand_totals) AND (length("rows") > 0))) THEN (replace_zzz("rows", main.list_value('dummy_column', 'value_names'))) ELSE '' END));
    CREATE OR REPLACE TEMP MACRO columns_values_axis_columns(table_names,"values",rows,columns,column_names,filters,values_axis,subtotals,grand_totals) AS  (((((((((('WITH raw_pivot AS (
                PIVOT (
                    ' || CASE  WHEN (((subtotals OR grand_totals) AND (length("rows") > 0))) THEN (nq_concat((main.list_value(((('FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
                            SELECT *, 1 as dummy_column
                            
                            -- FILTERS
                            ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), ''))) || list_transform(totals_list("rows", subtotals := subtotals, grand_totals := grand_totals), (k -> ((((('FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
                                SELECT * replace(') || k) || '), 1 as dummy_column

                                -- FILTERS
                                ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), ''))))), ' 
                            UNION ALL BY NAME 
                            ')) ELSE ((('
                        FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
                        SELECT *, 1 as dummy_column

                        -- FILTERS
                        ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), '')) END) || '
                )
                -- COLUMNS 
                -- When pivoting, do not use all combinations of values in the columns parameter,
                -- only use the combinations that actually exist in the data. 
                -- This is achieved by only pivoting ON one expression (that has all columns concatenated together)
                ON ') || dq_concat("columns", ' || ''|||'' || ')) || ' IN (' || sq_concat(column_names, ', ') || ')

                -- VALUES
                -- If values are passed in, use one or more values as summary metrics
                ') || COALESCE(('USING ' || nq_concat("values", ', ')), '')) || '

                -- ROWS
                GROUP BY dummy_column') || COALESCE((', ' || dq_concat("rows", ', ')), '')) || ' 
                ORDER BY ALL NULLS FIRST LIMIT 10000000000
            ) FROM raw_pivot 
            ') || CASE  WHEN (((subtotals OR grand_totals) AND (length("rows") > 0))) THEN (replace_zzz("rows", main.list_value('dummy_column'))) ELSE '' END));
    CREATE OR REPLACE TEMP MACRO no_columns(table_names,"values",rows,filters,values_axis,subtotals,grand_totals) AS  (((((((((((((((((('FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
            SELECT 
                -- ROWS 
                -- Select a dummy column and all columns in the rows parameter
                1 as dummy_column,
                
                -- If using subtotals or grand_totals, detect which rows are subtotals and/or grand_totals
                -- using the GROUPING function, since in these cases GROUPING SETS are in use.
                -- Then replace what would have been a NULL with the text Grand Total or Subtotal.
                ') || CASE  WHEN (((subtotals OR grand_totals) AND (length("rows") > 0))) THEN ((nq_concat(list_transform("rows", (r -> ((((((((('case when list_aggregate([' || nq_concat(list_transform("rows", (i -> (('GROUPING(' || dq(i)) || ')'))), ', ')) || '],
                            ''sum'') = ') || length("rows")) || ' then ''Grand Total''
                        when GROUPING(') || dq(r)) || ') = 1 then ''Subtotal'' 
                        else ') || dq(r)) || '::varchar 
                        end as ') || dq(r)))), ', ') || ', ')) ELSE COALESCE((dq_concat("rows", ', ') || ','), '') END) || '
                
                -- VALUES 
                -- If values_axis is columns, then just have a separate column for each value
                -- If values_axis is rows, unnest so that there is a separate row for each value
                ') || CASE  WHEN (((values_axis != 'rows') OR (length("values") = 0))) THEN ('') ELSE ((' UNNEST([' || sq_concat("values", ', ')) || ']) AS value_names, 
                        UNNEST([') END) || '
                        ') || COALESCE((nq_concat("values", ', ') || ' '), '')) || '
                ') || CASE  WHEN (((values_axis != 'rows') OR (length("values") = 0))) THEN ('') ELSE ']) AS "values" ' END) || '
            
            -- FILTERS 
            -- Filter the data if requested. The WHERE clause is entirely removed if filters is an empty list.
            ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), '')) || '
            
            -- If using subtotals, use a ROLLUP 
            -- (note this will include a grand_total, which is filtered out with a HAVING clause if grand_totals=0)
            -- If using grand totals and not subtotals, use GROUPING SETS to add just a total
            -- If no subtotals or grand totals, just GROUP BY ALL.
            GROUP BY ') || CASE  WHEN ((subtotals AND (length("rows") > 0))) THEN ((('ROLLUP (' || dq_concat("rows", ', ')) || ') ')) WHEN ((grand_totals AND (length("rows") > 0) AND (NOT subtotals))) THEN ((('GROUPING SETS ((), (' || dq_concat("rows", ', ')) || '))')) ELSE 'ALL ' END) || ' 
            
            -- If subtotals were requested, but not grand_totals, filter out the grand_totals row
            ') || CASE  WHEN (((NOT grand_totals) AND subtotals AND (length("rows") > 0))) THEN (((('HAVING 
            list_aggregate([' || nq_concat(list_transform("rows", (i -> (('GROUPING(' || dq(i)) || ')'))), ', ')) || '],
                            ''sum'') != ') || length("rows"))) ELSE '' END) || '
            
            -- If using subtotals or grand_totals, ensure the subtotal/grand_total rows are sorted below non-total values.
            -- If not, just ORDER BY ALL NULLS FIRST
            ORDER BY ') || CASE  WHEN (((subtotals OR grand_totals) AND (length("rows") > 0))) THEN (((nq_concat(list_transform("rows", (i -> ((('GROUPING(' || dq(i)) || '), ') || dq(i)))), ', ') || '
                    -- If we have values_axis of rows, we need to include the value_names column to maintain deterministic ordering
                    ') || CASE  WHEN (((values_axis = 'rows') AND (length("values") > 0))) THEN (', value_names ') ELSE ' ' END)) ELSE 'ALL NULLS FIRST ' END));
    CREATE OR REPLACE TEMP MACRO build_column_names(table_names,columns,filters) AS  (SELECT list(#1) FROM query((((((('
            FROM query(' || sq(nq_concat(list_transform(table_names, (table_name -> CASE WHEN table_name NOT ILIKE '%from%' THEN 'FROM query_table('||dq(table_name)||')' ELSE nq(table_name) END)), ' UNION ALL BY NAME '))) || ') 
            SELECT DISTINCT
                -- When pivoting, do not use all combinations of values in the columns parameter,
                -- only use the combinations that actually exist in the data. 
                -- This is achieved by only pivoting ON one expression (that has all columns concatenated together).
                -- Therefore, we concatenate everything together here with an _ separator.
                ') || COALESCE((nq_concat(list_transform(dq_list("columns"), (i -> (('coalesce(' || i) || '::varchar , ''NULL'')'))), ' || ''|||'' || ') || ''), '1')) || '
            ') || COALESCE(('WHERE 1=1 AND ' || nq_concat(filters, ' AND ')), '')) || '
            ORDER BY ALL
            ')));
    CREATE OR REPLACE TEMP MACRO pivot_table(table_names,"values",rows,columns,column_names,filters,values_axis,subtotals,grand_totals) AS  TABLE  (SELECT * EXCLUDE (dummy_column) FROM query(CASE  WHEN ((length("columns") = 0)) THEN (no_columns(table_names, "values", "rows", filters, values_axis := values_axis, subtotals := subtotals, grand_totals := grand_totals)) WHEN (((values_axis = 'columns') OR (length("values") = 0))) THEN (columns_values_axis_columns(table_names, "values", "rows", "columns", column_names, filters, values_axis := 'columns', subtotals := subtotals, grand_totals := grand_totals)) WHEN ((values_axis = 'rows')) THEN (columns_values_axis_rows(table_names, "values", "rows", "columns", column_names, filters, values_axis := 'rows', subtotals := subtotals, grand_totals := grand_totals)) ELSE NULL END));
    CREATE OR REPLACE TEMP MACRO pivot_table_show_sql(table_names,"values",rows,columns,column_names,filters,values_axis,subtotals,grand_totals) AS  TABLE  (SELECT CASE  WHEN ((length("columns") = 0)) THEN (no_columns(table_names, "values", "rows", filters, values_axis := values_axis, subtotals := subtotals, grand_totals := grand_totals)) WHEN (((values_axis = 'columns') OR (length("values") = 0))) THEN (columns_values_axis_columns(table_names, "values", "rows", "columns", column_names, filters, values_axis := 'columns', subtotals := subtotals, grand_totals := grand_totals)) WHEN ((values_axis = 'rows')) THEN (columns_values_axis_rows(table_names, "values", "rows", "columns", column_names, filters, values_axis := 'rows', subtotals := subtotals, grand_totals := grand_totals)) ELSE NULL END AS sql_string);
    select dq('woot');
    `);
  useEffect(() => {
    if (tempMacroQ.data) {
      console.log("temp macro results", tempMacroQ.data);
    }
    if (tempMacroQ.error) {
      console.log("temp macro results error:", tempMacroQ.error);
    }
  }, [tempMacroQ.data, tempMacroQ.error]);

  // DuckDB keywords for syntax highlighting (cached after first load)
  const keywordsQ = useSQLQuery(`SELECT keyword_name FROM duckdb_keywords()`);
  const keywordsSet = useMemo(() => {
    const rows = Array.isArray(keywordsQ.data) ? keywordsQ.data : [];
    return new Set(rows.map((r: any) => String(r.keyword_name).toUpperCase()));
  }, [keywordsQ.data]);

  // Physical table columns
  const colsQ = useSQLQuery(
    `SELECT column_name, data_type FROM duckdb_columns()
     WHERE database_name='${sq(selected?.db ?? "")}'
       AND schema_name='${sq(selected?.schema ?? "")}'
       AND table_name='${sq(selected?.table ?? "")}'
     ORDER BY column_index`,
    { enabled: !!selected && !isCustomSqlActive }
  );

  // Custom SQL columns via DESCRIBE
  const customColsSql = isCustomSqlActive
    ? `SELECT column_name, column_type as data_type FROM (DESCRIBE (${committedCustomSql}))`
    : "";
  const customColsQ = useSQLQuery(customColsSql, {
    enabled: isCustomSqlActive && committedCustomSql.trim().length > 0,
  });

  // Probe: check if custom SQL returns any rows
  const customProbeQ = useSQLQuery(
    isCustomSqlActive ? `SELECT 1 as __probe FROM (${committedCustomSql}) LIMIT 1` : "",
    { enabled: isCustomSqlActive && committedCustomSql.trim().length > 0 }
  );
  const customSqlEmpty = isCustomSqlActive && customProbeQ.isSuccess
    && Array.isArray(customProbeQ.data) && customProbeQ.data.length === 0;

  // Unified effective columns
  const lastGoodColsRef = useRef<any[]>([]);
  const effectiveCols = useMemo(() => {
    const fresh = isCustomSqlActive
      ? (Array.isArray(customColsQ.data) ? customColsQ.data : null)
      : (Array.isArray(colsQ.data) ? colsQ.data : null);
    if (fresh && fresh.length > 0) {
      lastGoodColsRef.current = fresh;
      return fresh;
    }
    // On error or empty, fall back to last successful columns
    const hasError = isCustomSqlActive ? customColsQ.isError : colsQ.isError;
    if (hasError && lastGoodColsRef.current.length > 0) return lastGoodColsRef.current;
    return fresh ?? [];
  }, [isCustomSqlActive, customColsQ.data, customColsQ.isError, colsQ.data, colsQ.isError]);
  const effectiveColsLoading = isCustomSqlActive ? customColsQ.isLoading : colsQ.isLoading;
  const effectiveColsError = isCustomSqlActive ? customColsQ.isError : colsQ.isError;
  const showingStaleColumns = effectiveColsError && effectiveCols.length > 0;

  const colTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of effectiveCols) {
      map.set(String((r as any).column_name), String((r as any).data_type));
    }
    return map;
  }, [effectiveCols]);

  const fqtn = selected
    ? `${selected.db}.${selected.schema}.${selected.table}`
    : "";

  // Compute date_trunc expressions for dims with granularity
  const dateTruncExprs = useMemo(() => {
    const allDims = [...columnItems, ...rowItems];
    const exprs: { sqlExpr: string; alias: string }[] = [];
    const seen = new Set<string>();
    for (const dim of allDims) {
      if (!dim.granularity) continue;
      const alias = dimColName(dim);
      if (seen.has(alias)) continue;
      seen.add(alias);
      const grans = [...TIMESTAMP_GRANULARITIES, ...DATE_GRANULARITIES];
      const gran = grans.find(g => g.key === dim.granularity);
      if (!gran || !gran.truncPart) continue;
      const quotedCol = dq(dim.col);
      const sqlExpr = dim.granularity === 'year'
        ? `year(${quotedCol})`
        : `date_trunc('${gran.truncPart}', ${quotedCol})`;
      exprs.push({ sqlExpr, alias });
    }
    return exprs;
  }, [columnItems, rowItems]);

  // Table source for pivot_table (first param) — wraps with date_trunc when needed
  const tableSourceParam = useMemo(() => {
    const baseSource = isCustomSqlActive ? committedCustomSql : fqtn;
    if (dateTruncExprs.length === 0) {
      return sqlList([baseSource]);
    }
    const selectParts = dateTruncExprs.map(e =>
      `${e.sqlExpr} as ${dq(e.alias)}`
    ).join(', ');
    const innerFrom = isCustomSqlActive
      ? `(${committedCustomSql}) __src`
      : fqtn;
    return sqlList([`SELECT *, ${selectParts} FROM ${innerFrom}`]);
  }, [isCustomSqlActive, committedCustomSql, fqtn, dateTruncExprs]);

  // FROM expression for filter dropdowns
  const fromExpr = isCustomSqlActive
    ? `(${committedCustomSql})`
    : selected
    ? `${dq(selected.db)}.${dq(selected.schema)}.${dq(selected.table)}`
    : "";

  // ── Drilldown SQL builder ───────────────────────────────────
  const buildDrilldownSql = useCallback((row: Record<string, unknown>, colHeader: string): string => {
    const conditions: string[] = [];
    // Row filters
    for (const dim of rowItems) {
      const alias = dimColName(dim);
      const rawVal = row[alias];
      const qc = dq(dim.col);
      // Subtotal/Grand Total: omit this dim's filter (drills across that dimension)
      if (rawVal != null) {
        const sv = String(rawVal);
        if (sv === 'Grand Total' || sv === 'Subtotal') continue;
      }
      if (rawVal == null) {
        conditions.push(`${qc} IS NULL`);
      } else if (dim.granularity) {
        const grans = [...TIMESTAMP_GRANULARITIES, ...DATE_GRANULARITIES];
        const gran = grans.find(g => g.key === dim.granularity);
        if (gran && gran.truncPart) {
          const sv = String(rawVal);
          conditions.push(dim.granularity === 'year'
            ? `CAST(year(${qc}) AS VARCHAR) = '${sq(sv)}'`
            : `CAST(date_trunc('${gran.truncPart}', ${qc}) AS VARCHAR) = '${sq(sv)}'`);
        }
      } else if (typeof rawVal === 'boolean') {
        conditions.push(`${qc} = ${rawVal}`);
      } else {
        conditions.push(`${qc} = '${sq(String(rawVal))}'`);
      }
    }
    // Column filters — parse |||‑separated dimension values from header
    if (columnItems.length > 0) {
      let dimPart = colHeader;
      if (hasColumnsAndMultipleValues(columnItems, valueItems, valuesAxis)) {
        let prefix = colHeader;
        if (colHeader.endsWith(')')) {
          const openIdx = colHeader.lastIndexOf('(');
          if (openIdx > 0) prefix = colHeader.slice(0, openIdx);
        }
        const lastUs = prefix.lastIndexOf('_');
        if (lastUs > 0) dimPart = prefix.slice(0, lastUs);
      }
      const parts = dimPart.split('|||');
      for (let i = 0; i < columnItems.length && i < parts.length; i++) {
        const dim = columnItems[i];
        const value = parts[i];
        const qc = dq(dim.col);
        const dtype = colTypeMap.get(dim.col) || '';
        if (dim.granularity) {
          const grans = [...TIMESTAMP_GRANULARITIES, ...DATE_GRANULARITIES];
          const gran = grans.find(g => g.key === dim.granularity);
          if (gran && gran.truncPart) {
            conditions.push(dim.granularity === 'year'
              ? `CAST(year(${qc}) AS VARCHAR) = '${sq(value)}'`
              : `CAST(date_trunc('${gran.truncPart}', ${qc}) AS VARCHAR) = '${sq(value)}'`);
          }
        } else if (/BOOL/i.test(dtype) && /^(true|false)$/i.test(value)) {
          conditions.push(`${qc} = ${value.toLowerCase()}`);
        } else {
          conditions.push(`${qc} = '${sq(value)}'`);
        }
      }
    }
    // Filter-quadrant expressions
    for (const f of filterItems) conditions.push(f.expr);
    // Build SQL
    const source = isCustomSqlActive
      ? `(${committedCustomSql})`
      : selected
      ? `${dq(selected.db)}.${dq(selected.schema)}.${dq(selected.table)}`
      : '';
    if (!source) return '';
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    return `SELECT * FROM ${source} __drilldown${where}`;
  }, [rowItems, columnItems, valueItems, valuesAxis, filterItems, isCustomSqlActive, committedCustomSql, selected, colTypeMap]);

  const onCellDoubleClick = useCallback((row: Record<string, unknown>, col: string) => {
    const rNames = dimColNames(rowItems);
    if (rNames.includes(col) || col === 'value_names') return;
    const sql = buildDrilldownSql(row, col);
    if (!sql) return;
    drilldownCounter.current += 1;
    const numericId = drilldownCounter.current;
    drillCounters.current[currentPivotId] = (drillCounters.current[currentPivotId] ?? 0) + 1;
    const drillNum = drillCounters.current[currentPivotId];
    const parentTab = tabs.find(t => t.id === currentPivotId);
    const parentLabel = parentTab?.label ?? 'Pivot';
    const parentColor = parentTab?.color ?? CHART_PALETTE[0];
    const id = `drill-${numericId}`;
    const label = `${parentLabel} Drill ${drillNum}`;
    setTabs(prev => [...prev, { id, label, type: 'drilldown' as const, parentId: currentPivotId, color: parentColor, sql, drilldownTableId: numericId }]);
    setActiveTabId(id);
  }, [rowItems, buildDrilldownSql, currentPivotId, tabs]);

  const filterExprs = useMemo(
    () => filterItems.map((f) => f.expr),
    [filterItems]
  );
  const valueExprs = useMemo(
    () => valueItems.map((v) => v.expr),
    [valueItems]
  );

  // build_column_names query
  const colNamesSql = useMemo(() => {
    if (!hasSource || columnItems.length === 0) return "";
    return `SELECT unnest(build_column_names(${tableSourceParam}, ${sqlList(dimColNames(columnItems))}, ${sqlList(filterExprs)})) as col_name`;
  }, [hasSource, tableSourceParam, columnItems, filterExprs]);

  const colNamesQ = useSQLQuery(colNamesSql, {
    enabled: tempMacroQ.isSuccess && hasSource && columnItems.length > 0 && colNamesSql.length > 0,
  });

  const colNamesList = useMemo(() => {
    const rows = Array.isArray(colNamesQ.data) ? colNamesQ.data : [];
    return rows.map((r) => String(r.col_name));
  }, [colNamesQ.data]);

  // pivot_table query
  const canPivot =
    hasSource && (rowItems.length > 0 || valueExprs.length > 0);
  const colNamesReady = columnItems.length === 0 || colNamesQ.isSuccess;

  // Per-tab temp table name so switching tabs doesn't overwrite another tab's results
  const pivotTempTable = `pivot_table_results_${currentPivotId.replace(/\W/g, '_')}`;

  // Step 1: Create temp table from pivot_table function (expensive)
  const createPivotTempSql = useMemo(() => {
    if (!canPivot || !colNamesReady) return "";
    const cn = columnItems.length > 0 ? colNamesList : [];
    const axisParam = valuesAxis ? `values_axis := '${valuesAxis}'` : `values_axis := 'columns'`;
    return `CREATE OR REPLACE TEMP TABLE ${pivotTempTable} AS FROM pivot_table(${tableSourceParam}, ${sqlList(valueExprs)}, ${sqlList(dimColNames(rowItems))}, ${sqlList(dimColNames(columnItems))}, ${sqlList(cn)}, ${sqlList(filterExprs)}, ${axisParam}, subtotals := ${showSubtotals}, grand_totals := ${showGrandTotals}) LIMIT ${maxRowCount}`;
  }, [
    canPivot,
    colNamesReady,
    pivotTempTable,
    tableSourceParam,
    valueExprs,
    rowItems,
    columnItems,
    colNamesList,
    filterExprs,
    valuesAxis,
    showSubtotals,
    showGrandTotals,
    maxRowCount,
  ]);

  // Cache of successfully created temp tables: tableName → SQL that created it
  const pivotCreateCache = useRef<Record<string, string>>({});
  const pivotTempCached = !!createPivotTempSql && pivotCreateCache.current[pivotTempTable] === createPivotTempSql;

  // Only run the expensive CREATE if this exact temp table hasn't been created yet
  const createPivotTempQ = useSQLQuery(pivotTempCached ? '' : createPivotTempSql, {
    enabled: !pivotTempCached && tempMacroQ.isSuccess && canPivot && colNamesReady && createPivotTempSql.length > 0,
  });
  useEffect(() => {
    if (createPivotTempQ.isSuccess && createPivotTempSql && !pivotTempCached) {
      console.log(`[pivot_table] CREATE completed for ${pivotTempTable}`);
      pivotCreateCache.current[pivotTempTable] = createPivotTempSql;
    }
  }, [createPivotTempQ.isSuccess, createPivotTempSql, pivotTempTable, pivotTempCached]);
  useEffect(() => {
    if (createPivotTempQ.isLoading) {
      console.log(`[pivot_table] Running CREATE for ${pivotTempTable}...`);
    }
  }, [createPivotTempQ.isLoading, pivotTempTable]);

  // Ready if cached (tab switch) OR just created
  const pivotTempReady = pivotTempCached || (createPivotTempQ.isSuccess && !!createPivotTempSql);

  // Reset sort and page when pivot params change
  useEffect(() => {
    setPivotSortColumns([]);
    setPivotPage(0);
  }, [createPivotTempSql]);

  // Count query for pagination
  const pivotCountSql = useMemo(() => {
    if (!pivotTempReady) return '';
    return `SELECT count(*)::INTEGER as cnt FROM ${pivotTempTable} -- v${createPivotTempSql.length}`;
  }, [pivotTempReady, createPivotTempSql]);

  const pivotCountQ = useSQLQuery(pivotCountSql, {
    enabled: pivotTempReady && pivotCountSql.length > 0,
  });
  const pivotTotalRows = useMemo(() => {
    const rows = Array.isArray(pivotCountQ.data) ? pivotCountQ.data : [];
    return rows.length > 0 ? Number(rows[0].cnt) : 0;
  }, [pivotCountQ.data]);

  // Reset page when sort or rows-per-page changes
  useEffect(() => {
    setPivotPage(0);
  }, [pivotSortColumns, pivotRowLimit]);

  // Step 2: Select from temp table (cheap — supports sorting + pagination)
  const pivotSelectSql = useMemo(() => {
    if (!pivotTempReady) return '';
    const rowColSet = (showSubtotals || showGrandTotals) ? new Set(dimColNames(rowItems)) : undefined;
    const orderBy = buildOrderByClause(pivotSortColumns, rowColSet);
    const offset = pivotPage * pivotRowLimit;
    return `SELECT * FROM ${pivotTempTable}${orderBy} LIMIT ${pivotRowLimit} OFFSET ${offset} -- v${createPivotTempSql.length}`;
  }, [pivotTempReady, createPivotTempSql, pivotSortColumns, rowItems, showSubtotals, showGrandTotals, pivotPage, pivotRowLimit]);

  const pivotQ = useSQLQuery(pivotSelectSql, {
    enabled: pivotTempReady && pivotSelectSql.length > 0,
  });

  // Step 3: Select ALL rows from temp table for charts (no pagination)
  const chartSelectSql = useMemo(() => {
    if (!pivotTempReady || chartType === 'table') return '';
    return `SELECT * FROM ${pivotTempTable} LIMIT 5000 -- chart-v${createPivotTempSql.length}`;
  }, [pivotTempReady, createPivotTempSql, chartType]);

  const chartQ = useSQLQuery(chartSelectSql, {
    enabled: chartSelectSql.length > 0,
  });

  const lastChartDataRef = useRef<any[]>([]);
  const chartPivotData = useMemo(() => {
    const fresh = Array.isArray(chartQ.data) ? chartQ.data : null;
    if (fresh) { lastChartDataRef.current = fresh; return fresh; }
    if (chartQ.isLoading && pivotTempReady && lastChartDataRef.current.length > 0) return lastChartDataRef.current;
    return [];
  }, [chartQ.data, chartQ.isLoading, pivotTempReady]);

  // ── Parallel query for legend sort: pivot_table with empty rows to get totals per column ──
  const legendTotalsSql = useMemo(() => {
    if (!canPivot || !colNamesReady) return '';
    if (chartType === 'table' || chartType === 'big-number') return '';
    if (legendSortOrder !== 'biggest-smallest' && legendSortOrder !== 'smallest-biggest') return '';
    if (columnItems.length === 0) return '';
    const cn = colNamesList;
    const axisParam = valuesAxis ? `values_axis := '${valuesAxis}'` : `values_axis := 'columns'`;
    return `SELECT * FROM pivot_table(${tableSourceParam}, ${sqlList(valueExprs)}, [], ${sqlList(dimColNames(columnItems))}, ${sqlList(cn)}, ${sqlList(filterExprs)}, ${axisParam}, subtotals := false, grand_totals := false) LIMIT 1`;
  }, [canPivot, colNamesReady, chartType, legendSortOrder, columnItems, colNamesList, tableSourceParam, valueExprs, filterExprs, valuesAxis]);

  const legendTotalsQ = useSQLQuery(legendTotalsSql, {
    enabled: tempMacroQ.isSuccess && legendTotalsSql.length > 0,
  });

  // ── Derived data ───────────────────────────────────────────────
  const tree = useMemo(() => {

    const data = Array.isArray(tablesQ.data) ? tablesQ.data : [];
    const map = new Map<string, Map<string, string[]>>();
    for (const r of data) {
      const db = String(r.database_name);
      const s = String(r.schema_name);
      const t = String(r.table_name);
      if (!map.has(db)) map.set(db, new Map());
      if (!map.get(db)!.has(s)) map.get(db)!.set(s, []);
      map.get(db)!.get(s)!.push(t);
    }
    return map;
  }, [tablesQ.data]);

  const lastPivotDataRef = useRef<any[]>([]);
  const pivotData = useMemo(() => {
    const fresh = Array.isArray(pivotQ.data) ? pivotQ.data : null;
    if (fresh) { lastPivotDataRef.current = fresh; return fresh; }
    if (pivotQ.isLoading && pivotTempReady && lastPivotDataRef.current.length > 0) return lastPivotDataRef.current;
    return [];
  }, [pivotQ.data, pivotQ.isLoading, pivotTempReady]);

  const pivotColumns = useMemo(() => {
    if (pivotData.length === 0) return [];
    return Object.keys(pivotData[0]);
  }, [pivotData]);

  const pivotColTypes = useMemo(() => {
    const map: Record<string, ColType> = {};
    for (const c of pivotColumns) map[c] = detectColumnType(c, pivotData);
    return map;
  }, [pivotColumns, pivotData]);

  // Initialize column widths for new columns
  useEffect(() => {
    if (pivotColumns.length > 0) {
      setColWidths(() => {
        const next: Record<string, number> = {};
        for (const col of pivotColumns) {
          next[col] = computeColWidth(col, colWidthMode, colWidthOverrides, {
            maxDataWidth: colWidthMaxData,
            fixedWidth: colWidthFixed,
            dataRows: pivotData,
          });
        }
        return next;
      });
    }
  }, [pivotColumns, colWidthMode, colWidthOverrides, colWidthMaxData, colWidthFixed, pivotData]);

  // Auto-populate series overrides when switching to composed chart
  useEffect(() => {
    if (chartType !== 'composed') return;
    const series = pivotColumns.filter(c => !rowColNamesSet.has(c) && c !== 'value_names');
    setSeriesOverrides(prev => {
      let changed = false;
      const next = { ...prev };
      for (const s of series) {
        if (!next[s]) { next[s] = {}; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [chartType, pivotColumns, rowItems]);

  const filteredData = useMemo(() => {
    const active = Object.entries(tblFilters).filter(
      ([, v]) => v != null
    ) as [string, Set<string>][];
    if (active.length === 0) return pivotData;
    return pivotData.filter((row) =>
      active.every(([col, selectedSet]) => {
        const cell = String(row[col] ?? "");
        return selectedSet.has(cell);
      })
    );
  }, [pivotData, tblFilters]);

  // Cascaded data: pivotData filtered by all OTHER column filters (excluding the open popup's column)
  const cascadedData = useMemo(() => {
    if (!filterPopup) return pivotData;
    const otherFilters = Object.entries(tblFilters)
      .filter(([col, v]) => v != null && col !== filterPopup) as [string, Set<string>][];
    if (otherFilters.length === 0) return pivotData;
    return pivotData.filter(row => otherFilters.every(([col, sel]) => sel.has(String(row[col] ?? ""))));
  }, [pivotData, tblFilters, filterPopup]);

  // Detect subtotal / grand total rows based on text values from pivot_table SQL
  const getRowType = useCallback(
    (row: Record<string, unknown>): "grand_total" | "subtotal" | "normal" => {
      if (rowItems.length === 0) return "normal";
      const rNames = dimColNames(rowItems);
      if (rNames.every((r) => String(row[r]) === "Grand Total")) return "grand_total";
      if (rNames.some((r) => String(row[r]) === "Subtotal")) return "subtotal";
      return "normal";
    },
    [rowItems]
  );

  const rowColNames = useMemo(() => dimColNames(rowItems), [rowItems]);
  const rowColNamesSet = useMemo(() => new Set(rowColNames), [rowColNames]);

  const chartReadyData = useMemo(() => {
    if (chartType === 'table') return filteredData;
    return chartPivotData.filter(row => {
      for (const r of rowColNames) {
        const v = String(row[r] ?? '');
        if (v === 'Subtotal' || v === 'Grand Total') return false;
      }
      return true;
    });
  }, [filteredData, chartPivotData, chartType, rowColNames]);

  // ── Sorted series columns for legend ordering ──────────────────
  const sortedSeriesCols = useMemo(() => {
    const series = pivotColumns.filter(c => !rowColNames.includes(c) && c !== 'value_names');
    if (series.length === 0) return series;
    if (legendSortOrder === 'a-z') {
      return [...series].sort((a, b) => a.localeCompare(b));
    }
    if (legendSortOrder === 'z-a') {
      return [...series].sort((a, b) => b.localeCompare(a));
    }
    // For biggest/smallest, use the parallel query results
    const totalsData = Array.isArray(legendTotalsQ.data) ? legendTotalsQ.data : [];
    if (totalsData.length === 0) return series;
    const totalsRow = totalsData[0] as Record<string, unknown>;
    const sorted = [...series].sort((a, b) => {
      const va = Number(totalsRow[a] ?? 0);
      const vb = Number(totalsRow[b] ?? 0);
      return vb - va;
    });
    return legendSortOrder === 'smallest-biggest' ? sorted.reverse() : sorted;
  }, [legendSortOrder, pivotColumns, rowColNames, legendTotalsQ.data]);

  // ── Chat LLM: imperative SQL execution via useSQLQuery ──────
  const [chatFlowSql, setChatFlowSql] = useState('');
  const chatFlowResolverRef = useRef<{ resolve: (rows: any[]) => void; reject: (err: Error) => void } | null>(null);
  const chatFlowSeqRef = useRef(0);
  const chatExpectLoadingRef = useRef(false);
  const chatFlowQ = useSQLQuery(chatFlowSql, { enabled: !!chatFlowSql });

  useEffect(() => {
    if (!chatFlowResolverRef.current) return;
    if (chatFlowQ.isLoading) { chatExpectLoadingRef.current = false; return; }
    if (chatExpectLoadingRef.current) return;
    if (chatFlowQ.isSuccess) {
      const { resolve } = chatFlowResolverRef.current;
      chatFlowResolverRef.current = null;
      resolve(Array.isArray(chatFlowQ.data) ? chatFlowQ.data as any[] : []);
    } else if (chatFlowQ.isError) {
      const { reject } = chatFlowResolverRef.current;
      chatFlowResolverRef.current = null;
      reject(chatFlowQ.error || new Error('Query failed'));
    }
  }, [chatFlowQ.isLoading, chatFlowQ.isSuccess, chatFlowQ.isError, chatFlowQ.data, chatFlowQ.error]);

  // Extract fields from prompt() struct result (handles both plain objects and entries format)
  const extractStructResult = (raw: any): Record<string, any> => {
    if (!raw) return {};
    const unwrap = (v: any): any => {
      if (v && typeof v === 'object' && 'values' in v && Array.isArray(v.values)) return v.values;
      return v;
    };
    // DuckDB struct string: {'key': 'value', ...} — parse key-value pairs
    if (typeof raw === 'string') {
      const obj: Record<string, any> = {};
      const re = /'?(\w+)'?\s*:\s*'([^']*)'/g;
      let m;
      while ((m = re.exec(raw)) !== null) obj[m[1]] = m[2];
      if (Object.keys(obj).length > 0) return obj;
      try { const parsed = JSON.parse(raw); if (typeof parsed === 'object') return parsed; } catch {}
      return {};
    }
    if (typeof raw === 'object' && !raw.entries) {
      const obj: Record<string, any> = {};
      for (const [k, v] of Object.entries(raw)) obj[k] = unwrap(v);
      return obj;
    }
    if (raw.entries && Array.isArray(raw.entries)) {
      const obj: Record<string, any> = {};
      for (const entry of raw.entries) obj[entry.key] = unwrap(entry.value);
      return obj;
    }
    return raw;
  };

  const VALID_VISUAL_TYPES = CHART_TYPES.map(ct => ct.id);

  const resolveTableName = useCallback((name: string): { db: string; schema: string; table: string } | null => {
    const parts = name.replace(/["'`]/g, '').split('.');
    const matches: { db: string; schema: string; table: string }[] = [];
    tree.forEach((schemas: any, db: any) => {
      schemas.forEach((tables: any, schema: any) => {
        for (const t of tables) {
          if (parts.length === 3) {
            if (db.toLowerCase() === parts[0].toLowerCase() && schema.toLowerCase() === parts[1].toLowerCase() && t.toLowerCase() === parts[2].toLowerCase()) matches.push({ db, schema, table: t });
          } else if (parts.length === 2) {
            if ((db.toLowerCase() === parts[0].toLowerCase() && t.toLowerCase() === parts[1].toLowerCase()) || (schema.toLowerCase() === parts[0].toLowerCase() && t.toLowerCase() === parts[1].toLowerCase())) matches.push({ db, schema, table: t });
          } else if (parts.length === 1) {
            if (t.toLowerCase() === parts[0].toLowerCase()) matches.push({ db, schema, table: t });
          }
        }
      });
    });
    return matches.length > 0 ? matches[0] : null;
  }, [tree]);

  // Execute SQL imperatively via useSQLQuery (promise-based wrapper)
  const execSql = useCallback((sql: string, signal: AbortSignal): Promise<any[]> => {
    console.log('[Chat SQL]', sql);
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(new Error('Aborted')); return; }
      chatExpectLoadingRef.current = true;
      chatFlowResolverRef.current = { resolve, reject };
      setChatFlowSql(sql + ` /* __cq${++chatFlowSeqRef.current} */`);
      signal.addEventListener('abort', () => {
        if (chatFlowResolverRef.current?.resolve === resolve) {
          chatFlowResolverRef.current = null;
          reject(new Error('Aborted'));
        }
      }, { once: true });
    });
  }, []);

  // Run the full 3-step chat flow imperatively
  const runChatFlow = useCallback(async (question: string) => {
    // Abort any previous flow
    chatAbortRef.current?.abort();
    const abort = new AbortController();
    chatAbortRef.current = abort;
    const { signal } = abort;

    setChatProcessing(true);
    try {
      // ── Step 1: identify table ──
      const tableList: string[] = [];
      tree.forEach((schemas: any, db: any) => {
        schemas.forEach((tables: any, schema: any) => {
          for (const t of tables) tableList.push(`${db}.${schema}.${t}`);
        });
      });
      if (tableList.length === 0) { addChatMessage('system', 'No tables found.'); return; }

      let resolved: { db: string; schema: string; table: string } | null = null;
      let step1Prompt = `You are a data analyst. Given tables and a user question, identify which single table best matches.\n\nAvailable tables:\n${tableList.join('\n')}\n\nUser question: ${question}`;
      for (let attempt = 0; attempt <= 5; attempt++) {
        if (signal.aborted) return;
        const escaped1 = step1Prompt.replace(/'/g, "''");
        const sql1 = `SELECT prompt('${escaped1}', model := 'gpt-5-mini', struct := {tableName: 'VARCHAR'}, struct_descr := {tableName: 'the fully qualified table name in database.schema.table format that best matches the user question'}) AS result`;
        const rows1 = await execSql(sql1, signal);
        const raw1 = rows1[0]?.result;
        console.log('[Chat Step 1] Raw response:', raw1);
        const parsed1 = extractStructResult(raw1);
        console.log('[Chat Step 1] Parsed:', parsed1);
        const tableName = parsed1?.tableName || raw1;
        addChatMessage('assistant', `Step 1: Identified table: ${tableName}`);
        resolved = resolveTableName(String(tableName));
        if (resolved) break;
        if (attempt < 5) {
          addChatMessage('system', `Table "${tableName}" not found, retrying... (${attempt + 1}/5)`);
          step1Prompt += `\n\nPrevious response "${tableName}" is not a valid table. Please return a table name exactly as listed above.`;
        }
      }
      if (!resolved) { addChatMessage('system', 'Could not identify a valid table after 5 retries.'); return; }
      addChatMessage('assistant', `Found table: ${resolved.db}.${resolved.schema}.${resolved.table}`);

      // ── Step 1.5: fetch columns ──
      if (signal.aborted) return;
      const colSql = `SELECT column_name, data_type FROM duckdb_columns() WHERE database_name='${sq(resolved.db)}' AND schema_name='${sq(resolved.schema)}' AND table_name='${sq(resolved.table)}' ORDER BY column_index`;
      const colRows = await execSql(colSql, signal);
      const columns = colRows.map((c: any) => ({ column_name: String(c.column_name), data_type: String(c.data_type) }));
      console.log('[Chat Step 1.5] Columns:', columns);
      if (columns.length === 0) { addChatMessage('system', 'No columns found for this table.'); return; }

      // ── Step 2: pivot parameters ──
      const colDesc = columns.map((c: any) => `  ${c.column_name} (${c.data_type})`).join('\n');
      const commonAggs = 'SUM, COUNT, AVG, MIN, MAX, MEDIAN';
      const validColNames = columns.map((c: any) => c.column_name as string);
      let step2Prompt = `You are a data analyst building a pivot table. Given a table's columns and a user question, determine the pivot parameters. Use double quotes around column names in values and filters. Keep it minimal - only include what the user asked for.\n\nTable: ${resolved.db}.${resolved.schema}.${resolved.table}\nColumns:\n${colDesc}\n\nUser question: ${question}`;

      let validatedParams: { filters: string[]; rows: string[]; columns: string[]; values: string[] } | null = null;
      for (let attempt = 0; attempt <= 5; attempt++) {
        if (signal.aborted) return;
        const escaped2 = step2Prompt.replace(/'/g, "''");
        const sql2 = `SELECT prompt('${escaped2}', model := 'gpt-5-mini', struct := {filters: 'VARCHAR[]', rows: 'VARCHAR[]', columns: 'VARCHAR[]', values: 'VARCHAR[]'}, struct_descr := {filters: 'an array of SQL WHERE clause filter expressions. Empty array if no filters implied.', rows: 'an array of column names for row grouping dimensions. Use exact column names from the table.', columns: 'an array of column names for column pivoting / color / legend series. Use exact column names from the table.', values: 'an array of aggregate expressions like AGG("column_name"), e.g. AVG("pm25_concentration"), SUM("sales"). Common aggregates: ${commonAggs}'}) AS result`;
        const rows2 = await execSql(sql2, signal);
        const raw2 = rows2[0]?.result;
        console.log('[Chat Step 2] Raw response:', raw2);
        const parsed2 = extractStructResult(raw2);
        console.log('[Chat Step 2] Parsed:', parsed2);
        const params = {
          filters: Array.isArray(parsed2?.filters) ? parsed2.filters : [],
          rows: Array.isArray(parsed2?.rows) ? parsed2.rows : [],
          columns: Array.isArray(parsed2?.columns) ? parsed2.columns : [],
          values: Array.isArray(parsed2?.values) ? parsed2.values : [],
        };
        addChatMessage('assistant', `Step 2: Pivot params:\n  Rows: ${JSON.stringify(params.rows)}\n  Columns: ${JSON.stringify(params.columns)}\n  Values: ${JSON.stringify(params.values)}\n  Filters: ${JSON.stringify(params.filters)}`);

        // Validate column names
        const fixCol = (name: string): string | null => {
          const exact = validColNames.find(c => c.toLowerCase() === name.toLowerCase());
          if (exact) return exact;
          const containing = validColNames.filter(c => c.toLowerCase().includes(name.toLowerCase()));
          return containing.length === 1 ? containing[0] : null;
        };
        const errors: string[] = [];
        const fixedRows = params.rows.map((r: string) => { const f = fixCol(r); if (!f) errors.push(`Row "${r}" invalid`); return f || r; });
        const fixedCols = params.columns.map((c: string) => { const f = fixCol(c); if (!f) errors.push(`Column "${c}" invalid`); return f || c; });

        if (errors.length === 0) {
          validatedParams = { ...params, rows: fixedRows, columns: fixedCols };
          break;
        }
        if (attempt < 5) {
          addChatMessage('system', `Validation errors: ${errors.join('; ')}. Retrying... (${attempt + 1}/5)`);
          step2Prompt += `\n\nErrors: ${errors.join('; ')}. Valid column names are: ${validColNames.join(', ')}. Please fix.`;
        }
      }
      if (!validatedParams) { addChatMessage('system', 'Could not determine valid pivot parameters after 5 retries.'); return; }

      // ── Step 3: visual type ──
      let step3Prompt = `You are a data visualization expert. Given a user question and pivot parameters, determine the best visual type.\n\nUser question: ${question}\n\nPivot parameters:\n- Rows: ${JSON.stringify(validatedParams.rows)}\n- Columns: ${JSON.stringify(validatedParams.columns)}\n- Values: ${JSON.stringify(validatedParams.values)}`;
      let visualType: ChartTypeId = 'table';
      for (let attempt = 0; attempt <= 5; attempt++) {
        if (signal.aborted) return;
        const escaped3 = step3Prompt.replace(/'/g, "''");
        const sql3 = `SELECT prompt('${escaped3}', model := 'gpt-5-mini', struct := {visualType: 'VARCHAR'}, struct_descr := {visualType: 'the visual type that best matches the user request. Must be one of: ${VALID_VISUAL_TYPES.join(', ')}. Use table for detailed data, bar for comparing categories, line for trends over time, stacked-line for stacked trends, area for filled trends, stacked-bar for parts of a whole, pie for proportions with few categories, scatter for correlations, big-number for single KPI values.'}) AS result`;
        const rows3 = await execSql(sql3, signal);
        const raw3 = rows3[0]?.result;
        console.log('[Chat Step 3] Raw response:', raw3);
        const parsed3 = extractStructResult(raw3);
        console.log('[Chat Step 3] Parsed:', parsed3);
        const vt = String(parsed3?.visualType || 'table').toLowerCase();
        addChatMessage('assistant', `Step 3: Visual type: ${vt}`);
        if (VALID_VISUAL_TYPES.includes(vt as ChartTypeId)) { visualType = vt as ChartTypeId; break; }
        if (attempt < 5) {
          addChatMessage('system', `Invalid visual type "${vt}". Retrying... (${attempt + 1}/5)`);
          step3Prompt += `\n\nPrevious response "${vt}" is not valid. Must be one of: ${VALID_VISUAL_TYPES.join(', ')}`;
        }
      }

      // ── Create the visual ──
      if (signal.aborted) return;
      // Select the table
      setSelected(resolved);
      setCustomSqlExpanded(false);
      setCommittedCustomSql('');
      const isTable = visualType === 'table';
      const tabType: 'pivot' | 'chart' = isTable ? 'pivot' : 'chart';
      if (!isViewingDashboard) savedTabStates.current[currentPivotId] = collectTabState();
      pivotTabCounter.current[tabType] += 1;
      const nn = pivotTabCounter.current[tabType];
      const tid = `${tabType}-${nn}`;
      const label = isTable ? `Pivot ${nn}` : `Chart ${nn}`;
      const pivotCount = tabs.filter((t: any) => t.type !== 'drilldown').length;
      const color = CHART_PALETTE[pivotCount % CHART_PALETTE.length];
      const newState = defaultTabState(tabType);
      newState.filterItems = validatedParams.filters.map((f: string) => ({ id: getId(), expr: f, col: f }));
      newState.rowItems = validatedParams.rows.map((r: string) => ({ id: getId(), col: r }));
      newState.columnItems = validatedParams.columns.map((c: string) => ({ id: getId(), col: c }));
      newState.valueItems = validatedParams.values.map((v: string) => ({ id: getId(), expr: v, col: v }));
      newState.chartType = visualType;
      setTabs((prev: any) => [...prev, { id: tid, label, type: tabType, color }]);
      savedTabStates.current[tid] = newState;
      applyTabState(newState);
      setActiveTabId(tid);
      addChatMessage('assistant', `Created a new ${isTable ? 'pivot table' : visualType + ' chart'} "${label}" using ${resolved.db}.${resolved.schema}.${resolved.table}!`);
    } catch (err: any) {
      if (err?.message === 'Aborted') return;
      console.error('[Chat] Error:', err);
      addChatMessage('system', `Error: ${err?.message || 'Unknown error'}. Please try again.`);
    } finally {
      if (!signal.aborted) setChatProcessing(false);
    }
  }, [tree, execSql, resolveTableName, addChatMessage, VALID_VISUAL_TYPES, isViewingDashboard, currentPivotId, tabs, collectTabState, defaultTabState, applyTabState, getId, savedTabStates]);

  // ── Tree toggle ────────────────────────────────────────────────
  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // ── Drag & Drop ────────────────────────────────────────────────
  dragRef.current = dragState;
  phantomRef.current = phantom;

  const extractColName = (text: string, sourceQuad: string): string => {
    if (sourceQuad === "values") {
      const m = text.match(/^\w+\((.+)\)$/);
      return m ? m[1] : text;
    }
    if (sourceQuad === "filters") {
      const m = text.match(/^(\S+)/);
      return m ? m[1] : text;
    }
    return text;
  };

  const removeAt = useCallback((quad: string, idx: number) => {
    if (idx < 0) return;
    const rm = <T,>(p: T[]) =>
      idx < p.length ? p.filter((_, i) => i !== idx) : p;
    if (quad === "filters") setFilterItems(rm);
    else if (quad === "columns") setColumnItems(rm);
    else if (quad === "rows") setRowItems(rm);
    else if (quad === "values") setValueItems(rm);
  }, []);

  const spliceInto = useCallback(
    (quad: string, colName: string, idx: number) => {
      if (quad === "filters") {
        const newId = getId();
        pendingFilterOpenRef.current = newId;
        setFilterItems((p) => {
          const n = [...p];
          n.splice(Math.min(idx, n.length), 0, {
            id: newId,
            expr: `${dq(colName)} = ${dq(colName)}`,
            col: colName,
          });
          return n;
        });
      } else if (quad === "columns") {
        const dtype = colTypeMap.get(colName) || '';
        const defaultGran = isTimestampLike(dtype) ? 'date' : undefined;
        setColumnItems((p) => {
          const n = [...p];
          n.splice(Math.min(idx, n.length), 0, { id: getId(), col: colName, granularity: defaultGran });
          return n;
        });
      } else if (quad === "rows") {
        const dtype = colTypeMap.get(colName) || '';
        const defaultGran = isTimestampLike(dtype) ? 'date' : undefined;
        setRowItems((p) => {
          const n = [...p];
          n.splice(Math.min(idx, n.length), 0, { id: getId(), col: colName, granularity: defaultGran });
          return n;
        });
      } else if (quad === "values") {
        setValueItems((p) => {
          const n = [...p];
          n.splice(Math.min(idx, n.length), 0, {
            id: getId(),
            expr: `COUNT(${colName})`,
          });
          return n;
        });
      }
    },
    [colTypeMap]
  );

  // Set or update the phantom (ghost chip rendered during drag, no state mutation)
  const setPhantomFor = useCallback(
    (quad: string, idx: number) => {
      const ds = dragRef.current;
      if (!ds) return;
      const colName = extractColName(ds.text, ds.sourceQuad);
      const next = { quad, idx, colName };
      phantomRef.current = next;
      setPhantom(next);
    },
    []
  );

  const clearPhantom = useCallback(() => {
    phantomRef.current = null;
    setPhantom(null);
  }, []);

  const startDrag = useCallback(
    (sourceQuad: string, sourceIdx: number, text: string) =>
      (e: React.DragEvent) => {
        e.dataTransfer.setData("text/plain", text);
        e.dataTransfer.effectAllowed = "move";
        const ds = { sourceQuad, sourceIdx, text };
        setDragState(ds);
        dragRef.current = ds;
        dropOkRef.current = false;
        clearPhantom();
      },
    [clearPhantom]
  );

  // Touch drag start for chips/column list items
  const startTouchDrag = useCallback(
    (sourceQuad: string, sourceIdx: number, text: string) =>
      (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchDragRef.current = {
          type: 'chip', sourceQuad, sourceIdx, text,
          startX: touch.clientX, startY: touch.clientY,
          active: false,
          timer: setTimeout(() => {
            const td = touchDragRef.current;
            if (td && !td.active) {
              td.active = true;
              const ds = { sourceQuad, sourceIdx, text };
              setDragState(ds);
              dragRef.current = ds;
              dropOkRef.current = false;
              clearPhantom();
              showTouchGhost(td.startX, td.startY, text);
            }
          }, 200),
        };
      },
    [clearPhantom]
  );

  // Touch drag start for tabs
  const startTouchTabDrag = useCallback(
    (tabIdx: number, tabId: string, label: string) =>
      (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchDragRef.current = {
          type: 'tab', tabIdx, tabId, text: label,
          startX: touch.clientX, startY: touch.clientY,
          active: false,
          timer: setTimeout(() => {
            const td = touchDragRef.current;
            if (td && !td.active) {
              td.active = true;
              tabDragRef.current = { dragIdx: tabIdx };
              showTouchGhost(td.startX, td.startY, label);
            }
          }, 200),
        };
      },
    []
  );

  // Touch-and-hold to open a context menu (replaces drag for chips with menus)
  const touchHoldAction = useCallback(
    (action: (x: number, y: number) => void) =>
      (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchDragRef.current = {
          type: 'chip', text: '',
          startX: touch.clientX, startY: touch.clientY,
          active: false,
          timer: setTimeout(() => {
            const td = touchDragRef.current;
            if (td && !td.active) {
              touchDragRef.current = null;
              action(td.startX, td.startY);
            }
          }, 400),
        };
      },
    []
  );

  // Chip dragOver: live reorder (same quad) or update phantom position (cross)
  const onChipDragOver = useCallback(
    (targetQuad: string, targetIdx: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const ds = dragRef.current;
      if (!ds) return;

      // Same quadrant → live reorder
      if (ds.sourceQuad === targetQuad) {
        if (ds.sourceIdx === targetIdx) return;
        const from = ds.sourceIdx;
        const reorder = <T,>(arr: T[]): T[] => {
          if (from < 0 || from >= arr.length) return arr;
          const next = [...arr];
          const [moved] = next.splice(from, 1);
          next.splice(targetIdx, 0, moved);
          return next;
        };
        if (targetQuad === "filters") setFilterItems(reorder);
        else if (targetQuad === "columns") setColumnItems(reorder);
        else if (targetQuad === "rows") setRowItems(reorder);
        else if (targetQuad === "values") setValueItems(reorder);
        const updated = { ...ds, sourceIdx: targetIdx };
        setDragState(updated);
        dragRef.current = updated;
        return;
      }

      // Different quadrant → show phantom at this position
      // Adjust index: phantom is rendered among real chips, so the visual
      // index maps 1:1 to insertion index.
      setPhantomFor(targetQuad, targetIdx);
    },
    [setPhantomFor]
  );

  // Container dragOver: highlight + phantom at end (empty space below chips)
  const onQuadDragOver = useCallback(
    (quad: string) => (e: React.DragEvent) => {
      e.preventDefault();
      const ds = dragRef.current;
      if (!ds || ds.sourceQuad === quad) return;
      // Block values_axis indicator from being dropped on filters/values
      if (ds.sourceQuad === "values_axis" && quad !== "columns" && quad !== "rows") return;
      setDragOver(quad);
      // Cursor is over empty space (chips call stopPropagation) → phantom at end
      const ph = phantomRef.current;
      if (!ph || ph.quad !== quad || ph.idx !== Infinity) {
        setPhantomFor(quad, Infinity);
      }
    },
    [setPhantomFor]
  );

  // Container dragLeave: clear phantom + highlight
  const onQuadDragLeave = useCallback(
    (quad: string) => (e: React.DragEvent) => {
      const container = e.currentTarget as HTMLElement;
      const related = e.relatedTarget as Node | null;
      // Only clear if cursor truly left the container
      if (related && container.contains(related)) return;
      setDragOver(null);
      if (phantomRef.current?.quad === quad) clearPhantom();
    },
    [clearPhantom]
  );

  // Drop: commit the item at the phantom position (or append)
  const onQuadDrop = useCallback(
    (targetQuad: string) => (e: React.DragEvent) => {
      e.preventDefault();
      dropOkRef.current = true;
      setDragOver(null);

      const ds = dragRef.current;
      if (!ds) {
        clearPhantom();
        return;
      }

      // Handle values_axis indicator: only allow columns/rows
      if (ds.sourceQuad === "values_axis") {
        if (targetQuad === "columns" || targetQuad === "rows") {
          setValuesAxis(targetQuad as "columns" | "rows");
        }
        clearPhantom();
        return;
      }

      if (ds.sourceQuad === targetQuad) {
        clearPhantom();
        return;
      }

      // Remove from source (skip for column list)
      if (ds.sourceQuad !== "list") removeAt(ds.sourceQuad, ds.sourceIdx);

      // Insert at phantom position or end
      const ph = phantomRef.current;
      const colName = extractColName(ds.text, ds.sourceQuad);
      const insertIdx = ph && ph.quad === targetQuad ? ph.idx : Infinity;
      spliceInto(targetQuad, colName, insertIdx);
      clearPhantom();
    },
    [removeAt, spliceInto, clearPhantom]
  );

  // Drag ended without drop — clean up
  const onDragEnd = useCallback(() => {
    if (!dropOkRef.current) {
      const ds = dragRef.current;
      if (ds && ds.sourceQuad !== "list" && ds.sourceQuad !== "values_axis") {
        removeAt(ds.sourceQuad, ds.sourceIdx);
      }
    }
    setDragState(null);
    dragRef.current = null;
    clearPhantom();
    setDragOver(null);
  }, [removeAt, clearPhantom]);

  // ── Global touch move/end handlers ──────────────────────────
  const spliceIntoRef = useRef(spliceInto);
  spliceIntoRef.current = spliceInto;
  const removeAtRef = useRef(removeAt);
  removeAtRef.current = removeAt;

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      const td = touchDragRef.current;
      if (!td) return;
      const touch = e.touches[0];

      if (!td.active) {
        const dx = touch.clientX - td.startX;
        const dy = touch.clientY - td.startY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (td.timer) clearTimeout(td.timer);
          touchDragRef.current = null;
        }
        return;
      }

      e.preventDefault();
      showTouchGhost(touch.clientX, touch.clientY, td.text);

      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      if (!el) return;

      if (td.type === 'chip') {
        const chipEl = el.closest('[data-chip-quad]') as HTMLElement | null;
        if (chipEl) {
          const targetQuad = chipEl.dataset.chipQuad!;
          const targetIdx = parseInt(chipEl.dataset.chipIdx!, 10);
          const ds = dragRef.current;
          if (!ds) return;

          if (ds.sourceQuad === targetQuad) {
            if (ds.sourceIdx === targetIdx) return;
            const from = ds.sourceIdx;
            const reorder = <T,>(arr: T[]): T[] => {
              if (from < 0 || from >= arr.length) return arr;
              const next = [...arr];
              const [moved] = next.splice(from, 1);
              next.splice(targetIdx, 0, moved);
              return next;
            };
            if (targetQuad === "filters") setFilterItems(reorder);
            else if (targetQuad === "columns") setColumnItems(reorder);
            else if (targetQuad === "rows") setRowItems(reorder);
            else if (targetQuad === "values") setValueItems(reorder);
            const updated = { ...ds, sourceIdx: targetIdx };
            setDragState(updated);
            dragRef.current = updated;
          } else {
            setPhantomFor(targetQuad, targetIdx);
          }
          setDragOver(targetQuad);
        } else {
          const quadEl = el.closest('[data-quad]') as HTMLElement | null;
          if (quadEl) {
            const quad = quadEl.dataset.quad!;
            const ds = dragRef.current;
            if (!ds || ds.sourceQuad === quad) return;
            if (ds.sourceQuad === "values_axis" && quad !== "columns" && quad !== "rows") return;
            setDragOver(quad);
            const ph = phantomRef.current;
            if (!ph || ph.quad !== quad || ph.idx !== Infinity) {
              setPhantomFor(quad, Infinity);
            }
          } else {
            setDragOver(null);
            if (phantomRef.current) clearPhantom();
          }
        }
      } else if (td.type === 'tab') {
        const tabEl = el.closest('[data-tab-idx]') as HTMLElement | null;
        const lastHighlit = touchDragRef.current?._lastHighlitTab as HTMLElement | undefined;
        if (lastHighlit && lastHighlit !== tabEl) lastHighlit.style.borderLeft = 'none';
        if (tabEl) tabEl.style.borderLeft = '2px solid #0777b3';
        if (touchDragRef.current) (touchDragRef.current as any)._lastHighlitTab = tabEl;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const td = touchDragRef.current;
      if (!td) return;
      if (td.timer) clearTimeout(td.timer);
      touchDragRef.current = null;
      hideTouchGhost();

      if (!td.active) return;

      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;

      if (td.type === 'chip') {
        const quadEl = el?.closest('[data-quad]') as HTMLElement | null;
        if (quadEl) {
          const targetQuad = quadEl.dataset.quad!;
          dropOkRef.current = true;
          setDragOver(null);
          const ds = dragRef.current;
          if (ds) {
            if (ds.sourceQuad === "values_axis") {
              if (targetQuad === "columns" || targetQuad === "rows") {
                setValuesAxis(targetQuad as "columns" | "rows");
              }
              clearPhantom();
            } else if (ds.sourceQuad === targetQuad) {
              // Same-quad reorder already happened during touchmove
              clearPhantom();
            } else {
              if (ds.sourceQuad !== "list") removeAtRef.current(ds.sourceQuad, ds.sourceIdx);
              const ph = phantomRef.current;
              const colName = extractColName(ds.text, ds.sourceQuad);
              const insertIdx = ph && ph.quad === targetQuad ? ph.idx : Infinity;
              spliceIntoRef.current(targetQuad, colName, insertIdx);
              clearPhantom();
            }
          }
        }
        // Clean up (same as onDragEnd)
        if (!dropOkRef.current) {
          const ds = dragRef.current;
          if (ds && ds.sourceQuad !== "list" && ds.sourceQuad !== "values_axis") {
            removeAtRef.current(ds.sourceQuad, ds.sourceIdx);
          }
        }
        setDragState(null);
        dragRef.current = null;
        clearPhantom();
        setDragOver(null);
      } else if (td.type === 'tab') {
        // Clear last highlighted tab
        const lastHighlit = (td as any)._lastHighlitTab as HTMLElement | undefined;
        if (lastHighlit) lastHighlit.style.borderLeft = 'none';

        // Check tab reorder
        const tabEl = el?.closest('[data-tab-idx]') as HTMLElement | null;
        if (tabEl && tabDragRef.current) {
          const toIdx = parseInt(tabEl.dataset.tabIdx!, 10);
          const fromIdx = tabDragRef.current.dragIdx;
          if (fromIdx !== toIdx) {
            setTabs((prev: any[]) => {
              const next = [...prev];
              const [moved] = next.splice(fromIdx, 1);
              next.splice(fromIdx < toIdx ? toIdx - 1 : toIdx, 0, moved);
              return next;
            });
          }
        }

        // Check dashboard canvas drop
        const canvasEl = el?.closest('[data-dashboard-canvas]') as HTMLElement | null;
        if (canvasEl && td.tabId) {
          const evt = new CustomEvent('touch-tab-drop', {
            detail: { tabId: td.tabId, x: touch.clientX, y: touch.clientY },
          });
          canvasEl.dispatchEvent(evt);
        }

        tabDragRef.current = null;
      }
    };

    const handleTouchCancel = () => {
      const td = touchDragRef.current;
      if (td?.timer) clearTimeout(td.timer);
      touchDragRef.current = null;
      hideTouchGhost();
      setDragState(null);
      dragRef.current = null;
      clearPhantom();
      setDragOver(null);
      tabDragRef.current = null;
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('touchcancel', handleTouchCancel);
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [setPhantomFor, clearPhantom]);

  // ── Remove helpers ─────────────────────────────────────────────
  const removeFrom = useCallback(
    (quad: string, idx: number) => {
      if (quad === "filters")
        setFilterItems((p) => p.filter((_, i) => i !== idx));
      else if (quad === "columns")
        setColumnItems((p) => p.filter((_, i) => i !== idx));
      else if (quad === "rows")
        setRowItems((p) => p.filter((_, i) => i !== idx));
      else if (quad === "values")
        setValueItems((p) => p.filter((_, i) => i !== idx));
    },
    []
  );

  // ── Edit helpers ───────────────────────────────────────────────
  const startEdit = useCallback((id: string, expr: string) => {
    setEditingId(id);
    setEditText(expr);
  }, []);

  const commitEdit = useCallback(
    (quad: "filters" | "values") => {
      if (!editingId) return;
      if (quad === "filters")
        setFilterItems((p) =>
          p.map((f) => (f.id === editingId ? { ...f, expr: editText } : f))
        );
      else
        setValueItems((p) =>
          p.map((v) => (v.id === editingId ? { ...v, expr: editText } : v))
        );
      setEditingId(null);
    },
    [editingId, editText]
  );

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const applyAggregate = useCallback((id: string, funcName: string) => {
    setValueItems((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const m = v.expr.match(/^\w+\((.+)\)$/);
        const colName = m ? m[1] : v.expr;
        return { ...v, expr: `${funcName}(${colName})` };
      })
    );
  }, []);

  const applyGranularity = useCallback((id: string, quad: 'columns' | 'rows', granularity: string) => {
    const setter = quad === 'columns' ? setColumnItems : setRowItems;
    setter((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        return { ...d, granularity: granularity || undefined };
      })
    );
  }, []);

  // ── Quadrant checkbox helpers (column list hover checkboxes) ────
  const isColInQuad = useCallback(
    (colName: string, quad: string): boolean => {
      if (quad === "filters") return filterItems.some((f) => f.col === colName);
      if (quad === "columns") return columnItems.some(d => d.col === colName);
      if (quad === "rows") return rowItems.some(d => d.col === colName);
      if (quad === "values") {
        return valueItems.some((v) => {
          const m = v.expr.match(/^\w+\((.+)\)$/);
          return m ? m[1] === colName : v.expr === colName;
        });
      }
      return false;
    },
    [filterItems, columnItems, rowItems, valueItems]
  );

  const toggleColInQuad = useCallback(
    (colName: string, quad: string) => {
      if (isColInQuad(colName, quad)) {
        // Remove all instances of this column from the quadrant
        if (quad === "filters") setFilterItems((p) => p.filter((f) => f.col !== colName));
        else if (quad === "columns") setColumnItems((p) => p.filter((c) => c.col !== colName));
        else if (quad === "rows") setRowItems((p) => p.filter((r) => r.col !== colName));
        else if (quad === "values")
          setValueItems((p) =>
            p.filter((v) => {
              const m = v.expr.match(/^\w+\((.+)\)$/);
              return m ? m[1] !== colName : v.expr !== colName;
            })
          );
      } else {
        // Add to the quadrant at the end (same behavior as drag)
        spliceInto(quad, colName, Infinity);
      }
    },
    [isColInQuad, spliceInto]
  );

  // ── Render helpers ─────────────────────────────────────────────
  // Render chips for a quadrant, splicing in the phantom ghost at the right spot
  const renderQuadChips = (
    quad: string,
    chips: React.ReactNode[],
  ) => {
    if (!phantom || phantom.quad !== quad) return chips;
    const ghost = (
      <div
        key="__phantom__"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          background: "#d0e4f5",
          color: "#0777b3",
          borderRadius: 4,
          padding: "3px 6px",
          fontSize: 11,
          opacity: 0.7,
          border: "1px dashed #0777b3",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {phantom.colName}
      </div>
    );
    const idx = Math.min(phantom.idx, chips.length);
    const result = [...chips];
    result.splice(idx, 0, ghost);
    return result;
  };

  const chipStyle: React.CSSProperties = {
    background: "#e8f0f8",
    color: "#231f20",
    borderRadius: 4,
    padding: "3px 6px",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  };

  const renderChip = (
    text: string,
    quad: string,
    idx: number,
    id?: string,
    editable?: boolean
  ) => {
    const isEditing = editable && editingId === id;
    return (
      <div
        key={id || `${quad}-${idx}`}
        className={quad === "values" && id ? "value-chip" : undefined}
        draggable={!isEditing}
        data-chip-quad={quad}
        data-chip-idx={idx}
        onDragStart={startDrag(quad, idx, text)}
        onDragOver={onChipDragOver(quad, idx)}
        onDragEnd={onDragEnd}
        onTouchStart={quad === "values" && id ? touchHoldAction((x, y) => {
          setAggMenuId(id);
          setAggMenuPos({
            top: y + 10 + 320 > window.innerHeight ? y - 324 : y + 10,
            left: Math.min(x - 50, window.innerWidth - 220),
          });
        }) : startTouchDrag(quad, idx, text)}
        onDoubleClick={
          editable && id ? () => startEdit(id, text) : undefined
        }
        style={{
          ...chipStyle,
          cursor: isEditing ? "text" : "grab",
        }}
      >
        {isEditing ? (
          <input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                commitEdit(quad as "filters" | "values");
              if (e.key === "Escape") cancelEdit();
            }}
            onBlur={() => commitEdit(quad as "filters" | "values")}
            style={{
              background: "transparent",
              outline: "none",
              border: "none",
              fontSize: 11,
              flex: 1,
              minWidth: 0,
              fontFamily: "inherit",
            }}
          />
        ) : (
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
            title={text}
          >
            {text}
          </span>
        )}
        {quad === "values" && id && !isEditing && (
          <button
            data-agg-menu="true"
            className="agg-trigger"
            data-active={aggMenuId === id ? "true" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              if (aggMenuId === id) {
                setAggMenuId(null);
                setAggMenuPos(null);
              } else {
                const rect = e.currentTarget.getBoundingClientRect();
                const top = rect.bottom + 4;
                setAggMenuId(id);
                setAggMenuPos({
                  top: top + 320 > window.innerHeight ? rect.top - 324 : top,
                  left: Math.min(rect.left, window.innerWidth - 220),
                });
              }
            }}
            style={{
              background: "none",
              border: "none",
              padding: "0 1px",
              cursor: "pointer",
              color: aggMenuId === id ? "#0777b3" : "#6a6a6a",
              display: "flex",
              flexShrink: 0,
              borderRadius: 3,
            }}
          >
            <MoreVertical size={11} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeFrom(quad, idx);
          }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "#6a6a6a",
            display: "flex",
            flexShrink: 0,
          }}
        >
          <X size={11} />
        </button>
      </div>
    );
  };

  const quadStyle = (name: string): React.CSSProperties => ({
    border:
      dragOver === name ? "2px dashed #0777b3" : "1px solid #e0e0e0",
    background: dragOver === name ? "#f0f7fc" : "#fafafa",
    borderRadius: 4,
    padding: 6,
    minHeight: 50,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    overflow: "auto",
    flex: 1,
  });

  const quadLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "#6a6a6a",
    textTransform: "uppercase" as const,
    marginBottom: 2,
    letterSpacing: 0.5,
  };

  // ── Main render ────────────────────────────────────────────────
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#f8f8f8",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#231f20",
      }}
    >
      <style>{`
        .value-chip .agg-trigger { opacity: 0; transition: opacity 0.15s; }
        .value-chip:hover .agg-trigger,
        .value-chip .agg-trigger[data-active="true"] { opacity: 1; }
        .dim-chip .date-gran-trigger { opacity: 0; transition: opacity 0.15s; }
        .dim-chip:hover .date-gran-trigger,
        .dim-chip .date-gran-trigger[data-active="true"] { opacity: 1; }
        .agg-dropdown::-webkit-scrollbar { width: 6px; }
        .agg-dropdown::-webkit-scrollbar-track { background: transparent; }
        .agg-dropdown::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
        .agg-dropdown::-webkit-scrollbar-thumb:hover { background: #999; }
        .agg-dropdown-item:hover { background: #f0f7fc; }
        .col-item .quad-check { opacity: 0; transition: opacity 0.12s; }
        .col-item .quad-check[data-active="true"] { opacity: 1; }
        .col-item:hover .quad-check { opacity: 1; }
        @media (pointer: coarse) {
          .value-chip .agg-trigger { opacity: 1; }
          .dim-chip .date-gran-trigger { opacity: 1; }
          .col-item .quad-check { opacity: 1; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {/* Header */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #e0e0e0",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Dive into Pivoting!
        </h1>
        <button
          onClick={() => setLeftPanelOpen(p => !p)}
          title={leftPanelOpen ? "Hide configuration panel" : "Show configuration panel"}
          style={{
            background: 'transparent',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
            padding: 4,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: leftPanelOpen ? '#333' : '#aaa',
            transition: 'all 0.15s',
          }}
        >
          <Settings size={15} />
        </button>
        {isCustomSqlActive ? (
          <span style={{ fontSize: 12, color: "#6b3fa0", display: "flex", alignItems: "center", gap: 4 }}>
            <Terminal size={12} /> Custom SQL
          </span>
        ) : selected ? (
          <span style={{ fontSize: 12, color: "#6a6a6a" }}>
            {fqtn}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left Panel ── */}
        {leftPanelOpen && <div
          ref={leftPanelRef}
          style={{
            width: leftWidth,
            minWidth: 250,
            maxWidth: 700,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            borderRight: "1px solid #e0e0e0",
            flexShrink: 0,
          }}
        >
          {leftPanelTab === 'setup' ? (
          <>
          {/* Tree section */}
          <div
            style={{
              flex: sectionFlex[0],
              overflow: "auto",
              padding: 8,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={quadLabelStyle}>Tables</div>
            {/* Custom SQL entry */}
            <div>
              <div
                onClick={() => {
                  const next = !customSqlExpanded;
                  setCustomSqlExpanded(next);
                  if (next) {
                    // Expanding custom SQL: clear physical table selection & quadrants
                    setSelected(null);
                    setFilterItems([]);
                    setColumnItems([]);
                    setRowItems([]);
                    setValueItems([]);
                    setValuesAxis(null);
                    setTblFilters({});
                    setFilterPopup(null);
                    setFilterDropdownId(null);
                    setFilterMetaMap({});
                    setTabs(prev => prev.filter(t => t.type !== 'drilldown' || t.parentId !== currentPivotId));
                    setActiveTabId(currentPivotId);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 4px",
                  borderRadius: 3,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: customSqlExpanded ? 600 : 500,
                  background: customSqlExpanded ? "#e8f0f8" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!customSqlExpanded) e.currentTarget.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  if (!customSqlExpanded) e.currentTarget.style.background = "transparent";
                }}
              >
                {customSqlExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Terminal size={12} style={{ color: "#6b3fa0" }} />
                <span style={{ flex: 1 }}>Custom SQL</span>
                {customSqlExpanded && (
                  <button
                    title="Run query (Shift+Enter)"
                    onClick={(e) => {
                      e.stopPropagation();
                      runCustomSql();
                    }}
                    style={{
                      background: customSqlText.trim() ? "#2d7a00" : "#ccc",
                      border: "none",
                      padding: "1px 6px",
                      cursor: customSqlText.trim() ? "pointer" : "default",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      borderRadius: 4,
                      flexShrink: 0,
                      gap: 3,
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                    onMouseEnter={(e) => { if (customSqlText.trim()) e.currentTarget.style.background = "#236600"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = customSqlText.trim() ? "#2d7a00" : "#ccc"; }}
                  >
                    <Play size={11} fill="#fff" />
                    Run
                  </button>
                )}
              </div>
            </div>
            {customSqlExpanded ? (
              /* SQL Editor (replaces table list) */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, marginTop: 4, minHeight: 0 }}>
                <SqlEditor
                  value={customSqlText}
                  onChange={setCustomSqlText}
                  keywords={keywordsSet}
                  onRun={runCustomSql}
                />
              </div>
            ) : (
              /* Physical table tree */
              <>
                {tablesQ.isLoading ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: 8,
                      fontSize: 12,
                      color: "#6a6a6a",
                    }}
                  >
                    <Loader2 className="animate-spin" size={14} /> Loading
                    tables...
                  </div>
                ) : tablesQ.isError ? (
                  <div style={{ fontSize: 11, color: "#bc1200", padding: 8 }}>
                    Error: {tablesQ.error?.message}
                  </div>
                ) : (
                  Array.from(tree.entries()).map(([db, schemas]) => {
                    const dbKey = db;
                    const dbExp = expanded.has(dbKey);
                    return (
                      <div key={db}>
                        <div
                          onClick={() => toggle(dbKey)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 4px",
                            borderRadius: 3,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f5f5f5")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          {dbExp ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                          <Database size={12} style={{ color: "#0777b3" }} />
                          <span style={{ fontWeight: 500 }}>{db}</span>
                        </div>
                        {dbExp &&
                          Array.from(schemas.entries()).map(
                            ([schema, tables]) => {
                              const sKey = `${db}.${schema}`;
                              const sExp = expanded.has(sKey);
                              return (
                                <div key={schema} style={{ paddingLeft: 16 }}>
                                  <div
                                    onClick={() => toggle(sKey)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 4,
                                      padding: "2px 4px",
                                      borderRadius: 3,
                                      cursor: "pointer",
                                      fontSize: 11,
                                      color: "#6a6a6a",
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.background =
                                        "#f5f5f5")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.background =
                                        "transparent")
                                    }
                                  >
                                    {sExp ? (
                                      <ChevronDown size={10} />
                                    ) : (
                                      <ChevronRight size={10} />
                                    )}
                                    <span>{schema}</span>
                                  </div>
                                  {sExp &&
                                    tables.map((table) => {
                                      const isSel =
                                        selected?.db === db &&
                                        selected?.schema === schema &&
                                        selected?.table === table;
                                      return (
                                        <div
                                          key={table}
                                          onClick={() => {
                                            setSelected({ db, schema, table });
                                            setCustomSqlExpanded(false);
                                            setFilterItems([]);
                                            setColumnItems([]);
                                            setRowItems([]);
                                            setValueItems([]);
                                            setValuesAxis(null);
                                            setTblFilters({});
                                            setFilterPopup(null);
                                            setFilterDropdownId(null);
                                            setFilterMetaMap({});
                                            setTabs(prev => prev.filter(t => t.type !== 'drilldown' || t.parentId !== currentPivotId));
                                            setActiveTabId(currentPivotId);
                                          }}
                                          style={{
                                            paddingLeft: 22,
                                            padding: "2px 4px 2px 22px",
                                            borderRadius: 3,
                                            cursor: "pointer",
                                            fontSize: 11,
                                            fontWeight: isSel ? 600 : 400,
                                            background: isSel
                                              ? "#e8f0f8"
                                              : "transparent",
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!isSel)
                                              e.currentTarget.style.background =
                                                "#f5f5f5";
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!isSel)
                                              e.currentTarget.style.background =
                                                "transparent";
                                          }}
                                        >
                                          {table}
                                        </div>
                                      );
                                    })}
                                </div>
                              );
                            }
                          )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Horizontal resize divider 1 */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              hResizing.current = { divider: 0, startY: e.clientY, startFlex: [...sectionFlex] };
            }}
            style={{
              height: 3,
              cursor: "row-resize",
              background: "#e0e0e0",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0777b3")}
            onMouseLeave={(e) => {
              if (!hResizing.current) e.currentTarget.style.background = "#e0e0e0";
            }}
          />

          {/* Columns section */}
          <div
            style={{
              flex: sectionFlex[1],
              overflow: "auto",
              padding: 8,
              minHeight: 0,
            }}
          >
            <div style={quadLabelStyle}>
              Columns{" "}
              {isCustomSqlActive ? (
                <span style={{ fontWeight: 400, textTransform: "none" }}>
                  — Custom SQL
                </span>
              ) : selected ? (
                <span style={{ fontWeight: 400, textTransform: "none" }}>
                  — {selected.table}
                </span>
              ) : null}
            </div>
            {!hasSource ? (
              <div style={{ fontSize: 11, color: "#adadad", padding: 8 }}>
                Select a table above
              </div>
            ) : effectiveColsLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: 8,
                  fontSize: 12,
                  color: "#6a6a6a",
                }}
              >
                <Loader2 className="animate-spin" size={14} /> Loading...
              </div>
            ) : (
              <>
              {showingStaleColumns && (
                <div style={{ fontSize: 10, color: "#bc1200", padding: "2px 6px 4px", fontStyle: "italic" }}>
                  Error loading columns. Showing last valid columns.
                </div>
              )}
              {effectiveCols.map((r: any, i: number) => {
                const colName = String(r.column_name);
                const dtype = String(r.data_type);
                const quads = [
                  { key: "filters", letter: "F" },
                  { key: "columns", letter: "C" },
                  { key: "rows", letter: "R" },
                  { key: "values", letter: "V" },
                ] as const;
                return (
                  <div
                    key={i}
                    className="col-item"
                    draggable
                    onDragStart={startDrag("list", -1, colName)}
                    onDragEnd={onDragEnd}
                    onTouchStart={startTouchDrag("list", -1, colName)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 6px",
                      borderRadius: 3,
                      cursor: "grab",
                      fontSize: 11,
                    }}
                    onMouseEnter={(e: any) =>
                      (e.currentTarget.style.background = "#f5f5f5")
                    }
                    onMouseLeave={(e: any) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {colName}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: "#adadad",
                        flexShrink: 0,
                      }}
                    >
                      {dtype}
                    </span>
                    <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      {quads.map(({ key, letter }) => {
                        const active = isColInQuad(colName, key);
                        const disabled = chartType === 'big-number' && (key === 'rows' || key === 'columns');
                        return (
                          <span
                            key={key}
                            className="quad-check"
                            data-active={active ? "true" : undefined}
                            title={disabled ? `${key.charAt(0).toUpperCase() + key.slice(1)} (disabled for Big Number)` : key.charAt(0).toUpperCase() + key.slice(1)}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              if (!disabled) toggleColInQuad(colName, key);
                            }}
                            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                            onDragStart={(e) => { e.stopPropagation(); e.preventDefault(); }}
                            draggable={false}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: disabled ? "not-allowed" : "pointer",
                              opacity: disabled ? 0.3 : undefined,
                              fontSize: 9,
                              fontWeight: 700,
                              lineHeight: 1,
                              flexShrink: 0,
                              border: active ? "1px solid #0777b3" : "1px solid #ccc",
                              background: active ? "#0777b3" : "#fff",
                              color: active ? "#fff" : "#6a6a6a",
                              userSelect: "none",
                            }}
                          >
                            {letter}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                );
              })}
              </>
            )}
          </div>

          {/* Horizontal resize divider 2 */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              hResizing.current = { divider: 1, startY: e.clientY, startFlex: [...sectionFlex] };
            }}
            style={{
              height: 3,
              cursor: "row-resize",
              background: "#e0e0e0",
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#0777b3")}
            onMouseLeave={(e) => {
              if (!hResizing.current) e.currentTarget.style.background = "#e0e0e0";
            }}
          />

          {/* Quadrants section */}
          <div
            style={{
              flex: sectionFlex[2],
              padding: 8,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr",
              gap: 6,
            }}
          >
            {/* Filters (top-left) */}
            <div
              data-quad="filters"
              onDragOver={onQuadDragOver("filters")}
              onDragLeave={onQuadDragLeave("filters")}
              onDrop={onQuadDrop("filters")}
              style={{ ...quadStyle("filters"), overflow: filterDropdownId ? "visible" : "auto" }}
            >
              <div style={quadLabelStyle}>Filters</div>
              {renderQuadChips(
                "filters",
                filterItems.map((f, i) => (
                  <div
                    key={f.id}
                    data-chip-quad="filters"
                    data-chip-idx={i}
                    style={{ position: "relative" }}
                    draggable
                    onDragStart={startDrag("filters", i, f.col || f.expr)}
                    onDragOver={onChipDragOver("filters", i)}
                    onDragEnd={onDragEnd}
                    onTouchStart={f.col ? touchHoldAction(() => setFilterDropdownId(f.id)) : startTouchDrag("filters", i, f.col || f.expr)}
                    onDoubleClick={() => {
                      if (f.col) setFilterDropdownId(f.id);
                    }}
                  >
                    <div style={{ ...chipStyle, cursor: "grab" }}>
                      <span
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                        title={f.expr}
                      >
                        {f.expr}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFrom("filters", i); }}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#6a6a6a", display: "flex", flexShrink: 0 }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                    {filterDropdownId === f.id && hasSource && f.col && (
                      <FilterQuadDropdown
                        col={f.col}
                        fromExpr={fromExpr}
                        initialMeta={filterMetaMap[f.id]}
                        applyRef={filterQuadApplyRef}
                        onApply={(expr, meta) => {
                          setFilterItems((p) => p.map((fi) => fi.id === f.id ? { ...fi, expr } : fi));
                          setFilterMetaMap((p) => ({ ...p, [f.id]: meta }));
                          setFilterDropdownId(null);
                        }}
                        onCancel={() => setFilterDropdownId(null)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Columns (top-right) */}
            <div
              data-quad="columns"
              onDragOver={chartType !== 'big-number' ? onQuadDragOver("columns") : undefined}
              onDragLeave={chartType !== 'big-number' ? onQuadDragLeave("columns") : undefined}
              onDrop={chartType !== 'big-number' ? onQuadDrop("columns") : undefined}
              style={{ ...quadStyle("columns"), ...(chartType === 'big-number' ? { opacity: 0.4, pointerEvents: 'none' as const } : {}) }}
            >
              <div style={quadLabelStyle}>Columns</div>
              {renderQuadChips(
                "columns",
                columnItems.map((item, i) => {
                  const text = dimColName(item);
                  const dtype = colTypeMap.get(item.col) || '';
                  const hasDateMenu = isDateLike(dtype);
                  const isTransformed = !!item.granularity;
                  return (
                    <div
                      key={item.id}
                      data-chip-quad="columns"
                      data-chip-idx={i}
                      className={hasDateMenu ? "dim-chip" : undefined}
                      draggable
                      onDragStart={startDrag("columns", i, item.col)}
                      onDragOver={onChipDragOver("columns", i)}
                      onDragEnd={onDragEnd}
                      onTouchStart={hasDateMenu ? touchHoldAction((x, y) => {
                        setDateMenuId(item.id);
                        setDateMenuPos({
                          top: y + 10 + 280 > window.innerHeight ? y - 284 : y + 10,
                          left: Math.min(x - 50, window.innerWidth - 180),
                        });
                      }) : startTouchDrag("columns", i, item.col)}
                      style={{ ...chipStyle, cursor: "grab", ...(isTransformed ? { background: "#e6f4e6", color: "#1a6b1a" } : {}) }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={text}>
                        {text}
                      </span>
                      {hasDateMenu && (
                        <button
                          data-date-menu="true"
                          className="date-gran-trigger"
                          data-active={dateMenuId === item.id ? "true" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dateMenuId === item.id) {
                              setDateMenuId(null);
                              setDateMenuPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDateMenuId(item.id);
                              setDateMenuPos({
                                top: rect.bottom + 4 + 280 > window.innerHeight ? rect.top - 284 : rect.bottom + 4,
                                left: Math.min(rect.left, window.innerWidth - 180),
                              });
                            }
                          }}
                          style={{
                            background: "none", border: "none", padding: "0 1px", cursor: "pointer",
                            color: dateMenuId === item.id ? "#0777b3" : "#6a6a6a",
                            display: "flex", flexShrink: 0, borderRadius: 3,
                          }}
                        >
                          <MoreVertical size={11} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFrom("columns", i); }}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#6a6a6a", display: "flex", flexShrink: 0 }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })
              )}
              {valuesAxis === "columns" && (
                <div
                  key="__values_axis__"
                  data-chip-quad="columns"
                  data-chip-idx={columnItems.length}
                  draggable
                  onDragStart={startDrag("values_axis", 0, "Σ Values")}
                  onDragEnd={onDragEnd}
                  onTouchStart={startTouchDrag("values_axis", 0, "Σ Values")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const ds = dragRef.current;
                    if (ds && ds.sourceQuad !== "values_axis") {
                      setPhantomFor("columns", Infinity);
                    }
                  }}
                  style={{
                    ...chipStyle,
                    background: "#f0e8f8",
                    color: "#6b3fa0",
                    cursor: "grab",
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    Σ Values
                  </span>
                </div>
              )}
            </div>

            {/* Rows (bottom-left) */}
            <div
              data-quad="rows"
              onDragOver={chartType !== 'big-number' ? onQuadDragOver("rows") : undefined}
              onDragLeave={chartType !== 'big-number' ? onQuadDragLeave("rows") : undefined}
              onDrop={chartType !== 'big-number' ? onQuadDrop("rows") : undefined}
              style={{ ...quadStyle("rows"), ...(chartType === 'big-number' ? { opacity: 0.4, pointerEvents: 'none' as const } : {}) }}
            >
              <div style={quadLabelStyle}>Rows</div>
              {renderQuadChips(
                "rows",
                rowItems.map((item, i) => {
                  const text = dimColName(item);
                  const dtype = colTypeMap.get(item.col) || '';
                  const hasDateMenu = isDateLike(dtype);
                  const isTransformed = !!item.granularity;
                  return (
                    <div
                      key={item.id}
                      data-chip-quad="rows"
                      data-chip-idx={i}
                      className={hasDateMenu ? "dim-chip" : undefined}
                      draggable
                      onDragStart={startDrag("rows", i, item.col)}
                      onDragOver={onChipDragOver("rows", i)}
                      onDragEnd={onDragEnd}
                      onTouchStart={hasDateMenu ? touchHoldAction((x, y) => {
                        setDateMenuId(item.id);
                        setDateMenuPos({
                          top: y + 10 + 280 > window.innerHeight ? y - 284 : y + 10,
                          left: Math.min(x - 50, window.innerWidth - 180),
                        });
                      }) : startTouchDrag("rows", i, item.col)}
                      style={{ ...chipStyle, cursor: "grab", ...(isTransformed ? { background: "#e6f4e6", color: "#1a6b1a" } : {}) }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={text}>
                        {text}
                      </span>
                      {hasDateMenu && (
                        <button
                          data-date-menu="true"
                          className="date-gran-trigger"
                          data-active={dateMenuId === item.id ? "true" : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dateMenuId === item.id) {
                              setDateMenuId(null);
                              setDateMenuPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setDateMenuId(item.id);
                              setDateMenuPos({
                                top: rect.bottom + 4 + 280 > window.innerHeight ? rect.top - 284 : rect.bottom + 4,
                                left: Math.min(rect.left, window.innerWidth - 180),
                              });
                            }
                          }}
                          style={{
                            background: "none", border: "none", padding: "0 1px", cursor: "pointer",
                            color: dateMenuId === item.id ? "#0777b3" : "#6a6a6a",
                            display: "flex", flexShrink: 0, borderRadius: 3,
                          }}
                        >
                          <MoreVertical size={11} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFrom("rows", i); }}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#6a6a6a", display: "flex", flexShrink: 0 }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })
              )}
              {valuesAxis === "rows" && (
                <div
                  key="__values_axis__"
                  data-chip-quad="rows"
                  data-chip-idx={rowItems.length}
                  draggable
                  onDragStart={startDrag("values_axis", 0, "Σ Values")}
                  onDragEnd={onDragEnd}
                  onTouchStart={startTouchDrag("values_axis", 0, "Σ Values")}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const ds = dragRef.current;
                    if (ds && ds.sourceQuad !== "values_axis") {
                      setPhantomFor("rows", Infinity);
                    }
                  }}
                  style={{
                    ...chipStyle,
                    background: "#f0e8f8",
                    color: "#6b3fa0",
                    cursor: "grab",
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    Σ Values
                  </span>
                </div>
              )}
            </div>

            {/* Values (bottom-right) */}
            <div
              data-quad="values"
              onDragOver={onQuadDragOver("values")}
              onDragLeave={onQuadDragLeave("values")}
              onDrop={onQuadDrop("values")}
              style={quadStyle("values")}
            >
              <div style={quadLabelStyle}>Values</div>
              {renderQuadChips(
                "values",
                valueItems.map((v, i) =>
                  renderChip(v.expr, "values", i, v.id, true)
                )
              )}
            </div>
          </div>
          </>
          ) : (
            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              {/* ── Maximum Row Count (shared across all visuals) ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={SECTION_HEADER_STYLE}>Maximum Row Count</div>
                <FontSizeInput label="Max rows" value={maxRowCount} onChange={setMaxRowCount} min={1000} max={1000000000} defaultVal={1000000} />
              </div>
              <div style={{ borderTop: '1px solid #e0e0e0', marginBottom: 16 }} />
              {activeTab !== 'pivot' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* ── Drilldown Title ── */}
                  <div>
                    <div style={SECTION_HEADER_STYLE}>
                      Table Title
                    </div>
                    <input
                      type="text"
                      value={drilldownTitle}
                      onChange={(e) => setDrilldownTitle(e.target.value)}
                      placeholder="Enter table title..."
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: 12,
                        border: '1px solid #e0e0e0',
                        borderRadius: 4,
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, maxWidth: 120 }}>
                      <FontSizeInput label="Size" value={drilldownTitleFontSize} onChange={setDrilldownTitleFontSize} min={1} max={96} defaultVal={16} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{ fontSize: 11, color: '#6a6a6a', marginRight: 4 }}>Position</label>
                      {(['left', 'center', 'right'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setDrilldownTitlePosition(pos)}
                          style={{
                            padding: '3px 10px',
                            fontSize: 11,
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            background: drilldownTitlePosition === pos ? '#0777b3' : '#fff',
                            color: drilldownTitlePosition === pos ? '#fff' : '#333',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Row Limit ── */}
                  <div>
                    <div style={SECTION_HEADER_STYLE}>Row Limit</div>
                    <FontSizeInput label="Rows per page" value={drilldownRowLimit} onChange={setDrilldownRowLimit} min={10} max={5000} defaultVal={100} />
                  </div>

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 1: Font Size ── */}
                  <FontSizePair
                    headerValue={drilldownHeaderFontSize} dataValue={drilldownDataFontSize}
                    onHeaderChange={setDrilldownHeaderFontSize} onDataChange={setDrilldownDataFontSize}
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 2: Column Widths ── */}
                  <ColumnWidthSection
                    mode={drilldownColWidthMode} setMode={setDrilldownColWidthMode}
                    maxDataWidth={drilldownColWidthMaxData} setMaxDataWidth={setDrilldownColWidthMaxData}
                    fixedWidth={drilldownColWidthFixed} setFixedWidth={setDrilldownColWidthFixed}
                    overrides={drilldownColWidthOverrides} setOverrides={setDrilldownColWidthOverrides}
                    availableColumns={pivotColumns} radioName="drilldownColWidthMode"
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 3: Column Text Formatting ── */}
                  <ColumnTextFormatSection
                    formats={drilldownColumnTextFormats} setFormats={setDrilldownColumnTextFormats}
                    availableColumns={pivotColumns}
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 4: Data Formatting ── */}
                  <DataFormatSection
                    globalFmt={drilldownDataFormat} setGlobalFmt={setDrilldownDataFormat}
                    columnFormats={drilldownColumnDataFormats} setColumnFormats={setDrilldownColumnDataFormats}
                    availableColumns={pivotColumns}
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 5: Conditional Formatting ── */}
                  <ConditionalFormatSection
                    rules={drilldownConditionalFormats} setRules={setDrilldownConditionalFormats}
                    columns={pivotColumns} idPrefix="dcf" nextIdRef={nextIdRef}
                  />

                </div>
              ) : chartType === 'big-number' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* ── Font Size ── */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#999', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>
                      Number Display
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: '#6a6a6a', minWidth: 60 }}>Font Size</label>
                      <input
                        type="number" min={12} max={200}
                        value={bigNumberFontSize}
                        onChange={(e) => setBigNumberFontSize(Math.max(12, Math.min(200, parseInt(e.target.value) || 48)))}
                        style={{ width: 56, fontSize: 11, padding: '3px 6px', border: '1px solid #e0e0e0', borderRadius: 4, fontFamily: 'inherit' }}
                      />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#333', cursor: 'pointer', marginBottom: 8 }}>
                      <input type="checkbox" checked={bigNumberAbbreviate}
                        onChange={(e) => setBigNumberAbbreviate(e.target.checked)}
                        style={{ margin: 0 }} />
                      Abbreviate (1.4M, 10T, etc.)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: '#6a6a6a', minWidth: 90 }}>Decimal Places</label>
                      <input
                        type="number" min={0} max={10}
                        value={bigNumberDecimalPlaces}
                        onChange={(e) => setBigNumberDecimalPlaces(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                        style={{ width: 56, fontSize: 11, padding: '3px 6px', border: '1px solid #e0e0e0', borderRadius: 4, fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Title ── */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#999', marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>
                      Title
                    </div>
                    <input
                      type="text"
                      value={bigNumberTitle}
                      onChange={(e) => setBigNumberTitle(e.target.value)}
                      placeholder="Enter title..."
                      style={{
                        width: '100%', padding: '6px 8px', fontSize: 12,
                        border: '1px solid #e0e0e0', borderRadius: 4, outline: 'none',
                        boxSizing: 'border-box' as const, marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: '#6a6a6a', marginRight: 4 }}>Position</label>
                      {(['above', 'below'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setBigNumberTitlePosition(pos)}
                          style={{
                            padding: '3px 10px', fontSize: 11,
                            border: '1px solid #e0e0e0', borderRadius: 4,
                            background: bigNumberTitlePosition === pos ? '#0777b3' : '#fff',
                            color: bigNumberTitlePosition === pos ? '#fff' : '#333',
                            cursor: 'pointer', textTransform: 'capitalize' as const,
                          }}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11, color: '#6a6a6a', minWidth: 60 }}>Title Size</label>
                      <input
                        type="number" min={8} max={96}
                        value={bigNumberTitleFontSize}
                        onChange={(e) => setBigNumberTitleFontSize(Math.max(8, Math.min(96, parseInt(e.target.value) || 14)))}
                        style={{ width: 56, fontSize: 11, padding: '3px 6px', border: '1px solid #e0e0e0', borderRadius: 4, fontFamily: 'inherit' }}
                      />
                    </div>
                  </div>

                </div>
              ) : chartType !== 'table' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* ── Section 1: Chart Title ── */}
                  <div>
                    <div style={CHART_SECTION_HEADER_STYLE}>
                      Chart Title
                    </div>
                    <input
                      type="text"
                      value={chartTitle}
                      onChange={(e) => setChartTitle(e.target.value)}
                      placeholder="Enter chart title..."
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: 12,
                        border: '1px solid #e0e0e0',
                        borderRadius: 4,
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, maxWidth: 120 }}>
                      <FontSizeInput label="Size" value={chartTitleFontSize} onChange={setChartTitleFontSize} min={1} max={96} defaultVal={16} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{ fontSize: 11, color: '#6a6a6a', marginRight: 4 }}>Position</label>
                      {(['left', 'center', 'right'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setChartTitlePosition(pos)}
                          style={{
                            padding: '3px 10px',
                            fontSize: 11,
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            background: chartTitlePosition === pos ? '#0777b3' : '#fff',
                            color: chartTitlePosition === pos ? '#fff' : '#333',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Section 2: Data Labels ── */}
                  <div>
                    <div style={CHART_SECTION_HEADER_STYLE}>
                      Data Labels
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>
                      <ToggleSwitch checked={dataLabelsEnabled} onChange={setDataLabelsEnabled} />
                      <span style={{ fontSize: 11, color: '#6a6a6a' }}>Show Labels</span>
                    </label>
                    {dataLabelsEnabled && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <label style={{ fontSize: 11, color: '#6a6a6a', marginRight: 4 }}>Position</label>
                          {(['above', 'on', 'below'] as const).map((pos) => (
                            <button
                              key={pos}
                              onClick={() => setDataLabelsPosition(pos)}
                              style={{
                                padding: '3px 10px',
                                fontSize: 11,
                                border: '1px solid #e0e0e0',
                                borderRadius: 4,
                                background: dataLabelsPosition === pos ? '#0777b3' : '#fff',
                                color: dataLabelsPosition === pos ? '#fff' : '#333',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                              }}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 120 }}>
                          <FontSizeInput label="Size" value={dataLabelsFontSize} onChange={setDataLabelsFontSize} min={1} max={96} defaultVal={11} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Text Color</label>
                          <input
                            type="color"
                            value={dataLabelsColor || '#231f20'}
                            onChange={(e) => setDataLabelsColor(e.target.value)}
                            style={{ width: 24, height: 24, border: '1px solid #e0e0e0', borderRadius: 4, padding: 0, cursor: 'pointer' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Background</label>
                          <input
                            type="color"
                            value={dataLabelsBgColor || '#ffffff'}
                            onChange={(e) => setDataLabelsBgColor(e.target.value)}
                            style={{ width: 24, height: 24, border: '1px solid #e0e0e0', borderRadius: 4, padding: 0, cursor: 'pointer' }}
                          />
                          {dataLabelsBgColor && (
                            <button
                              onClick={() => setDataLabelsBgColor('')}
                              style={{ fontSize: 10, color: '#6a6a6a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              clear
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <label style={{ fontSize: 11, color: '#6a6a6a', marginRight: 4 }}>Style</label>
                          <button
                            onClick={() => setDataLabelsBold((v) => !v)}
                            style={{
                              padding: '3px 10px',
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid #e0e0e0',
                              borderRadius: 4,
                              background: dataLabelsBold ? '#0777b3' : '#fff',
                              color: dataLabelsBold ? '#fff' : '#333',
                              cursor: 'pointer',
                            }}
                          >
                            B
                          </button>
                          <button
                            onClick={() => setDataLabelsItalic((v) => !v)}
                            style={{
                              padding: '3px 10px',
                              fontSize: 11,
                              fontStyle: 'italic',
                              border: '1px solid #e0e0e0',
                              borderRadius: 4,
                              background: dataLabelsItalic ? '#0777b3' : '#fff',
                              color: dataLabelsItalic ? '#fff' : '#333',
                              cursor: 'pointer',
                            }}
                          >
                            I
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── Section 3: Legend ── */}
                  <div>
                    <div style={CHART_SECTION_HEADER_STYLE}>
                      Legend
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>
                      <ToggleSwitch checked={legendEnabled} onChange={setLegendEnabled} />
                      <span style={{ fontSize: 11, color: '#6a6a6a' }}>Show Legend</span>
                    </label>
                    {legendEnabled && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <label style={{ fontSize: 11, color: '#6a6a6a', marginRight: 4 }}>Position</label>
                          {(['bottom', 'left', 'right', 'top'] as const).map((pos) => (
                            <button
                              key={pos}
                              onClick={() => setLegendPosition(pos)}
                              style={{
                                padding: '3px 8px',
                                fontSize: 11,
                                border: '1px solid #e0e0e0',
                                borderRadius: 4,
                                background: legendPosition === pos ? '#0777b3' : '#fff',
                                color: legendPosition === pos ? '#fff' : '#333',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                              }}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, maxWidth: 140 }}>
                          <FontSizeInput label="Font Size" value={legendFontSize} onChange={setLegendFontSize} min={1} max={96} defaultVal={13} />
                        </div>
                        {(['stacked-bar', 'stacked-horizontal-bar', 'stacked-line', 'stacked-area'] as ChartTypeId[]).includes(chartType) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' as const }}>Sort Order</label>
                            <select
                              value={legendSortOrder}
                              onChange={(e: any) => setLegendSortOrder(e.target.value)}
                              style={{ flex: 1, fontSize: 11, padding: '3px 6px', border: '1px solid #e0e0e0', borderRadius: 4, background: '#fff' }}
                            >
                              <option value="biggest-smallest">Biggest-Smallest</option>
                              <option value="smallest-biggest">Smallest-Biggest</option>
                              <option value="a-z">A-Z</option>
                              <option value="z-a">Z-A</option>
                            </select>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Section 4: Color Theme ── */}
                  <div>
                    <div style={CHART_SECTION_HEADER_STYLE}>
                      Color Theme
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(COLOR_THEMES).map(([key, theme]) => (
                        <label
                          key={key}
                          onClick={() => setColorTheme(key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 6px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: colorTheme === key ? '#f0f7fb' : 'transparent',
                            border: colorTheme === key ? '1px solid #0777b3' : '1px solid transparent',
                          }}
                        >
                          <input
                            type="radio"
                            name="colorTheme"
                            checked={colorTheme === key}
                            onChange={() => setColorTheme(key)}
                            style={{ margin: 0, accentColor: '#0777b3' }}
                          />
                          <span style={{ fontSize: 11, color: '#333', minWidth: 70 }}>{theme.label}</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {theme.colors.slice(0, 6).map((c, i) => (
                              <div
                                key={i}
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: 2,
                                  background: c,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                }}
                              />
                            ))}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* ── Section: Default Series Type (composed only) ── */}
                  {chartType === 'composed' && (
                    <div>
                      <div style={CHART_SECTION_HEADER_STYLE}>Default Series Type</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {(['bar', 'line', 'area'] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => setComposedDefaultType(t)}
                            style={{
                              padding: '3px 8px',
                              fontSize: 11,
                              border: '1px solid',
                              borderColor: composedDefaultType === t ? '#0777b3' : '#e0e0e0',
                              background: composedDefaultType === t ? '#e8f4fa' : '#fff',
                              color: composedDefaultType === t ? '#0777b3' : '#333',
                              borderRadius: 4,
                              cursor: 'pointer',
                              fontWeight: composedDefaultType === t ? 600 : 400,
                            }}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                        <span style={{ width: 1, height: 16, background: '#e0e0e0', flexShrink: 0 }} />
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: composedDefaultType === 'line' ? 'default' : 'pointer', userSelect: 'none' as const, flexShrink: 0, opacity: composedDefaultType === 'line' ? 0.35 : 1 }}>
                          <ToggleSwitch checked={composedStacked && composedDefaultType !== 'line'} onChange={(v) => { if (composedDefaultType !== 'line') setComposedStacked(v); }} />
                          <span style={{ fontSize: 11, color: '#6a6a6a' }}>Stacked</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* ── Section: Bars (bar/horizontal-bar/stacked-bar/stacked-horizontal-bar/composed) ── */}
                  {(['bar', 'horizontal-bar', 'stacked-bar', 'stacked-horizontal-bar', 'composed'] as ChartTypeId[]).includes(chartType) && (
                    <div>
                      <div style={CHART_SECTION_HEADER_STYLE}>Bars</div>
                      {chartType !== 'stacked-bar' && chartType !== 'stacked-horizontal-bar' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Bar Gap %</label>
                          <input
                            type="range" min={0} max={100} value={chartBarGap}
                            onChange={(e: any) => setChartBarGap(Number(e.target.value))}
                            style={{ flex: 1, accentColor: '#0777b3' }}
                          />
                          <span style={{ fontSize: 11, color: '#333', minWidth: 20, textAlign: 'right' }}>{chartBarGap}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Bar Category Gap %</label>
                        <input
                          type="range" min={0} max={100} value={chartBarCategoryGap}
                          onChange={(e: any) => setChartBarCategoryGap(Number(e.target.value))}
                          style={{ flex: 1, accentColor: '#0777b3' }}
                        />
                        <span style={{ fontSize: 11, color: '#333', minWidth: 20, textAlign: 'right' }}>{chartBarCategoryGap}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Section: Lines (line/area/composed only) ── */}
                  {(['line', 'stacked-line', 'area', 'stacked-area', 'composed'] as ChartTypeId[]).includes(chartType) && (
                    <div>
                      <div style={CHART_SECTION_HEADER_STYLE}>Lines</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' as const, marginBottom: 8 }}>
                        <ToggleSwitch checked={showLines} onChange={setShowLines} />
                        <span style={{ fontSize: 11, color: '#6a6a6a' }}>Show Lines</span>
                      </label>
                      {showLines && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
                          <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' as const }}>Width</label>
                          <input
                            type="range"
                            min={0.5}
                            max={8}
                            step={0.5}
                            value={chartLineWidth}
                            onChange={(e: any) => setChartLineWidth(Number(e.target.value))}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontSize: 11, color: '#333', minWidth: 24, textAlign: 'right' as const }}>{chartLineWidth}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Section 5: Data Point Markers (line/area/scatter/composed only) ── */}
                  {(['line', 'stacked-line', 'area', 'stacked-area', 'scatter', 'composed'] as ChartTypeId[]).includes(chartType) && (
                    <div>
                      <div style={CHART_SECTION_HEADER_STYLE}>
                        Data Point Markers
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', marginBottom: 8 }}>
                        <ToggleSwitch checked={markersEnabled} onChange={setMarkersEnabled} />
                        <span style={{ fontSize: 11, color: '#6a6a6a' }}>Show Markers</span>
                      </label>
                      {markersEnabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Size</label>
                            <input
                              type="range"
                              min={1}
                              max={12}
                              value={markerSize}
                              onChange={(e) => setMarkerSize(Number(e.target.value))}
                              style={{ flex: 1, accentColor: '#0777b3' }}
                            />
                            <span style={{ fontSize: 11, color: '#333', minWidth: 16, textAlign: 'right' }}>{markerSize}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, color: '#6a6a6a' }}>Shape Theme</label>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(['circles', 'triangles', 'squares', 'diamonds', 'mixed'] as const).map((shape) => (
                                <button
                                  key={shape}
                                  onClick={() => setMarkerShapeTheme(shape)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: 11,
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 4,
                                    background: markerShapeTheme === shape ? '#0777b3' : '#fff',
                                    color: markerShapeTheme === shape ? '#fff' : '#333',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {shape}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <label style={{ fontSize: 11, color: '#6a6a6a' }}>Fill Style</label>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(['solid', 'border'] as const).map((style) => (
                                <button
                                  key={style}
                                  onClick={() => setMarkerFill(style)}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: 11,
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 4,
                                    background: markerFill === style ? '#0777b3' : '#fff',
                                    color: markerFill === style ? '#fff' : '#333',
                                    cursor: 'pointer',
                                    textTransform: 'capitalize' as const,
                                  }}
                                >
                                  {style === 'solid' ? 'Solid' : 'Border Only'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Section 6: Series Overrides ── */}
                  <div>
                    <div style={CHART_SECTION_HEADER_STYLE}>
                      Series Overrides
                    </div>
                    {(() => {
                      const allSeries = pivotColumns.filter(c => !rowColNamesSet.has(c) && c !== 'value_names');
                      const overridePalette = (colorTheme && colorTheme !== 'default' && COLOR_THEMES[colorTheme]) ? COLOR_THEMES[colorTheme].colors : CHART_PALETTE;
                      return Object.entries(seriesOverrides).map(([seriesName, overrides]) => {
                      const effType = chartType === 'composed' ? (overrides.seriesChartType || composedDefaultType || 'line') : null;
                      const isBarType = chartType === 'composed'
                        ? effType === 'bar'
                        : (['bar', 'horizontal-bar', 'stacked-bar', 'stacked-horizontal-bar'] as ChartTypeId[]).includes(chartType);
                      const isAreaType = chartType === 'composed'
                        ? effType === 'area'
                        : (['area', 'stacked-area'] as ChartTypeId[]).includes(chartType);
                      const seriesIdx = allSeries.indexOf(seriesName);
                      const defaultColor = seriesIdx >= 0 ? overridePalette[seriesIdx % overridePalette.length] : '#0777b3';
                      return (
                      <div key={seriesName} style={{ marginBottom: 8, padding: 8, background: '#f8f8f8', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{seriesName}</span>
                          <button
                            onClick={() => {
                              setSeriesOverrides((prev) => {
                                const next = { ...prev };
                                delete next[seriesName];
                                return next;
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#999',
                              fontSize: 14,
                              padding: '0 2px',
                              lineHeight: 1,
                            }}
                            title="Remove override"
                          >
                            ×
                          </button>
                        </div>
                        {chartType === 'composed' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {/* Row 1: Type, Color, [Lines toggle + label + Width] or [Bar Width] */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <select
                                value={overrides.seriesChartType || composedDefaultType || 'line'}
                                onChange={(e) => {
                                  setSeriesOverrides((prev) => ({
                                    ...prev,
                                    [seriesName]: { ...prev[seriesName], seriesChartType: e.target.value as 'bar' | 'line' | 'area' },
                                  }));
                                }}
                                style={{ fontSize: 11, padding: '3px 4px', border: '1px solid #e0e0e0', borderRadius: 4, outline: 'none', width: 56 }}
                              >
                                <option value="bar">Bar</option>
                                <option value="line">Line</option>
                                <option value="area">Area</option>
                              </select>
                              <input
                                type="color"
                                value={overrides.color || defaultColor}
                                onChange={(e) => {
                                  setSeriesOverrides((prev) => ({
                                    ...prev,
                                    [seriesName]: { ...prev[seriesName], color: e.target.value },
                                  }));
                                }}
                                style={{ width: 24, height: 24, border: '1px solid #e0e0e0', borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                              />
                              {!isBarType && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' as const, flexShrink: 0 }}>
                                  <ToggleSwitch
                                    checked={overrides.showLines ?? true}
                                    onChange={(v) => {
                                      setSeriesOverrides((prev) => ({
                                        ...prev,
                                        [seriesName]: { ...prev[seriesName], showLines: v },
                                      }));
                                    }}
                                  />
                                  <span style={{ fontSize: 10, color: '#6a6a6a' }}>Lines</span>
                                </label>
                              )}
                              {!isBarType && (
                                <>
                                  <label style={{ fontSize: 10, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Width</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={overrides.lineWidth ?? ''}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || undefined;
                                      setSeriesOverrides((prev) => ({
                                        ...prev,
                                        [seriesName]: { ...prev[seriesName], lineWidth: val },
                                      }));
                                    }}
                                    placeholder="–"
                                    style={{
                                      width: 38,
                                      padding: '3px 4px',
                                      fontSize: 11,
                                      border: '1px solid #e0e0e0',
                                      borderRadius: 4,
                                      outline: 'none',
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            {/* Area: opacity (above marker row) */}
                            {isAreaType && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Opacity</label>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={overrides.areaOpacity ?? 0.3}
                                  onChange={(e) => {
                                    setSeriesOverrides((prev) => ({
                                      ...prev,
                                      [seriesName]: { ...prev[seriesName], areaOpacity: Number(e.target.value) },
                                    }));
                                  }}
                                  style={{ flex: 1, accentColor: '#0777b3' }}
                                />
                                <span style={{ fontSize: 11, color: '#333', minWidth: 28, textAlign: 'right' }}>
                                  {(overrides.areaOpacity ?? 0.3).toFixed(2)}
                                </span>
                              </div>
                            )}
                            {/* Line/Area: Marker toggle + solid/border + size slider (fills remaining space) */}
                            {!isBarType && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' as const, flexShrink: 0 }}>
                                  <ToggleSwitch
                                    checked={overrides.markersEnabled ?? true}
                                    onChange={(v) => {
                                      setSeriesOverrides((prev) => ({
                                        ...prev,
                                        [seriesName]: { ...prev[seriesName], markersEnabled: v },
                                      }));
                                    }}
                                  />
                                  <span style={{ fontSize: 10, color: '#6a6a6a' }}>Marker</span>
                                </label>
                                {(overrides.markersEnabled ?? true) && (
                                  <>
                                    {(['solid', 'border'] as const).map((style) => {
                                      const active = (overrides.markerFill ?? 'solid') === style;
                                      return (
                                        <button
                                          key={style}
                                          onClick={() => {
                                            setSeriesOverrides((prev) => ({
                                              ...prev,
                                              [seriesName]: { ...prev[seriesName], markerFill: style },
                                            }));
                                          }}
                                          style={{
                                            padding: '2px 5px',
                                            fontSize: 10,
                                            border: '1px solid',
                                            borderColor: active ? '#0777b3' : '#e0e0e0',
                                            borderRadius: 3,
                                            background: active ? '#0777b3' : '#fff',
                                            color: active ? '#fff' : '#333',
                                            cursor: 'pointer',
                                            lineHeight: '16px',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {style === 'solid' ? 'Solid' : 'Border'}
                                        </button>
                                      );
                                    })}
                                    <input
                                      type="range"
                                      min={1}
                                      max={12}
                                      value={overrides.markerSize ?? 4}
                                      onChange={(e) => {
                                        setSeriesOverrides((prev) => ({
                                          ...prev,
                                          [seriesName]: { ...prev[seriesName], markerSize: Number(e.target.value) },
                                        }));
                                      }}
                                      style={{ flex: 1, accentColor: '#0777b3', minWidth: 30 }}
                                    />
                                    <span style={{ fontSize: 10, color: '#333', minWidth: 12, flexShrink: 0 }}>{overrides.markerSize ?? 4}</span>
                                  </>
                                )}
                              </div>
                            )}
                            {/* Line/Area: shape theme buttons (when markers enabled) */}
                            {!isBarType && (overrides.markersEnabled ?? true) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                {(['circles', 'triangles', 'squares', 'diamonds', 'mixed'] as const).map((shape) => {
                                  const active = (overrides.markerShapeTheme ?? 'circles') === shape;
                                  return (
                                    <button
                                      key={shape}
                                      onClick={() => {
                                        setSeriesOverrides((prev) => ({
                                          ...prev,
                                          [seriesName]: { ...prev[seriesName], markerShapeTheme: shape },
                                        }));
                                      }}
                                      style={{
                                        padding: '2px 5px',
                                        fontSize: 10,
                                        border: '1px solid',
                                        borderColor: active ? '#0777b3' : '#e0e0e0',
                                        borderRadius: 3,
                                        background: active ? '#0777b3' : '#fff',
                                        color: active ? '#fff' : '#333',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        lineHeight: '16px',
                                      }}
                                    >
                                      {shape === 'mixed' ? 'Mix' : shape.slice(0, -1)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {/* Row 1: Color, [Lines toggle + label + Width] or [Bar Width] */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input
                                type="color"
                                value={overrides.color || defaultColor}
                                onChange={(e) => {
                                  setSeriesOverrides((prev) => ({
                                    ...prev,
                                    [seriesName]: { ...prev[seriesName], color: e.target.value },
                                  }));
                                }}
                                style={{ width: 24, height: 24, border: '1px solid #e0e0e0', borderRadius: 4, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                              />
                              {!isBarType && (
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' as const, flexShrink: 0 }}>
                                  <ToggleSwitch
                                    checked={overrides.showLines ?? true}
                                    onChange={(v) => {
                                      setSeriesOverrides((prev) => ({
                                        ...prev,
                                        [seriesName]: { ...prev[seriesName], showLines: v },
                                      }));
                                    }}
                                  />
                                  <span style={{ fontSize: 10, color: '#6a6a6a' }}>Lines</span>
                                </label>
                              )}
                              {!isBarType && (
                                <>
                                  <label style={{ fontSize: 10, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Width</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={overrides.lineWidth ?? ''}
                                    onChange={(e) => {
                                      const val = Number(e.target.value) || undefined;
                                      setSeriesOverrides((prev) => ({
                                        ...prev,
                                        [seriesName]: { ...prev[seriesName], lineWidth: val },
                                      }));
                                    }}
                                    placeholder="–"
                                    style={{
                                      width: 38,
                                      padding: '3px 4px',
                                      fontSize: 11,
                                      border: '1px solid #e0e0e0',
                                      borderRadius: 4,
                                      outline: 'none',
                                    }}
                                  />
                                </>
                              )}
                            </div>
                            {/* Area: opacity (above marker row) */}
                            {isAreaType && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: 11, color: '#6a6a6a', whiteSpace: 'nowrap' }}>Opacity</label>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.05}
                                  value={overrides.areaOpacity ?? 0.3}
                                  onChange={(e) => {
                                    setSeriesOverrides((prev) => ({
                                      ...prev,
                                      [seriesName]: { ...prev[seriesName], areaOpacity: Number(e.target.value) },
                                    }));
                                  }}
                                  style={{ flex: 1, accentColor: '#0777b3' }}
                                />
                                <span style={{ fontSize: 11, color: '#333', minWidth: 28, textAlign: 'right' }}>
                                  {(overrides.areaOpacity ?? 0.3).toFixed(2)}
                                </span>
                              </div>
                            )}
                            {/* Line/Area: Marker toggle + solid/border + size slider */}
                            {!isBarType && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' as const, flexShrink: 0 }}>
                                  <ToggleSwitch
                                    checked={overrides.markersEnabled ?? true}
                                    onChange={(v) => {
                                      setSeriesOverrides((prev) => ({
                                        ...prev,
                                        [seriesName]: { ...prev[seriesName], markersEnabled: v },
                                      }));
                                    }}
                                  />
                                  <span style={{ fontSize: 10, color: '#6a6a6a' }}>Marker</span>
                                </label>
                                {(overrides.markersEnabled ?? true) && (
                                  <>
                                    {(['solid', 'border'] as const).map((style) => {
                                      const active = (overrides.markerFill ?? 'solid') === style;
                                      return (
                                        <button
                                          key={style}
                                          onClick={() => {
                                            setSeriesOverrides((prev) => ({
                                              ...prev,
                                              [seriesName]: { ...prev[seriesName], markerFill: style },
                                            }));
                                          }}
                                          style={{
                                            padding: '2px 5px',
                                            fontSize: 10,
                                            border: '1px solid',
                                            borderColor: active ? '#0777b3' : '#e0e0e0',
                                            borderRadius: 3,
                                            background: active ? '#0777b3' : '#fff',
                                            color: active ? '#fff' : '#333',
                                            cursor: 'pointer',
                                            lineHeight: '16px',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {style === 'solid' ? 'Solid' : 'Border'}
                                        </button>
                                      );
                                    })}
                                    <input
                                      type="range"
                                      min={1}
                                      max={12}
                                      value={overrides.markerSize ?? 4}
                                      onChange={(e) => {
                                        setSeriesOverrides((prev) => ({
                                          ...prev,
                                          [seriesName]: { ...prev[seriesName], markerSize: Number(e.target.value) },
                                        }));
                                      }}
                                      style={{ flex: 1, accentColor: '#0777b3', minWidth: 30 }}
                                    />
                                    <span style={{ fontSize: 10, color: '#333', minWidth: 12, flexShrink: 0 }}>{overrides.markerSize ?? 4}</span>
                                  </>
                                )}
                              </div>
                            )}
                            {/* Line/Area: shape theme buttons (when markers enabled) */}
                            {!isBarType && (overrides.markersEnabled ?? true) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                {(['circles', 'triangles', 'squares', 'diamonds', 'mixed'] as const).map((shape) => {
                                  const active = (overrides.markerShapeTheme ?? 'circles') === shape;
                                  return (
                                    <button
                                      key={shape}
                                      onClick={() => {
                                        setSeriesOverrides((prev) => ({
                                          ...prev,
                                          [seriesName]: { ...prev[seriesName], markerShapeTheme: shape },
                                        }));
                                      }}
                                      style={{
                                        padding: '2px 5px',
                                        fontSize: 10,
                                        border: '1px solid',
                                        borderColor: active ? '#0777b3' : '#e0e0e0',
                                        borderRadius: 3,
                                        background: active ? '#0777b3' : '#fff',
                                        color: active ? '#fff' : '#333',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        lineHeight: '16px',
                                      }}
                                    >
                                      {shape === 'mixed' ? 'Mix' : shape.slice(0, -1)}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    });
                    })()}
                    {(() => {
                      const availableSeries = pivotColumns.filter(
                        (c) => !rowColNamesSet.has(c) && c !== 'value_names' && !seriesOverrides[c]
                      );
                      if (availableSeries.length === 0) return null;
                      return (
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={(e) => {
                              const btn = e.currentTarget;
                              const dropdown = btn.nextElementSibling as HTMLElement | null;
                              if (dropdown) {
                                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
                              }
                            }}
                            style={{
                              fontSize: 11,
                              color: '#0777b3',
                              background: 'none',
                              border: '1px dashed #0777b3',
                              borderRadius: 4,
                              padding: '4px 10px',
                              cursor: 'pointer',
                              width: '100%',
                            }}
                          >
                            + Add Override
                          </button>
                          <div
                            style={{
                              display: 'none',
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              background: '#fff',
                              border: '1px solid #e0e0e0',
                              borderRadius: 4,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                              zIndex: 10,
                              maxHeight: 150,
                              overflow: 'auto',
                            }}
                          >
                            {availableSeries.map((s) => (
                              <div
                                key={s}
                                onClick={(e) => {
                                  setSeriesOverrides((prev) => ({ ...prev, [s]: {} }));
                                  const dropdown = (e.currentTarget.parentElement) as HTMLElement | null;
                                  if (dropdown) dropdown.style.display = 'none';
                                }}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0f7fb'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                              >
                                {s}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* ── Section 7: Axis Limits ── */}
                  <div>
                    <div style={CHART_SECTION_HEADER_STYLE}>
                      Axis Limits
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#6a6a6a', display: 'block', marginBottom: 4 }}>X Axis</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: '#999' }}>Min</label>
                            <input
                              type="text"
                              value={xAxisMin}
                              onChange={(e) => setXAxisMin(e.target.value)}
                              placeholder="auto"
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                fontSize: 11,
                                border: '1px solid #e0e0e0',
                                borderRadius: 4,
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: '#999' }}>Max</label>
                            <input
                              type="text"
                              value={xAxisMax}
                              onChange={(e) => setXAxisMax(e.target.value)}
                              placeholder="auto"
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                fontSize: 11,
                                border: '1px solid #e0e0e0',
                                borderRadius: 4,
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6a6a6a', display: 'block', marginBottom: 4 }}>Y Axis</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: '#999' }}>Min</label>
                            <input
                              type="text"
                              value={yAxisMin}
                              onChange={(e) => setYAxisMin(e.target.value)}
                              placeholder="auto"
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                fontSize: 11,
                                border: '1px solid #e0e0e0',
                                borderRadius: 4,
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 10, color: '#999' }}>Max</label>
                            <input
                              type="text"
                              value={yAxisMax}
                              onChange={(e) => setYAxisMax(e.target.value)}
                              placeholder="auto"
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                fontSize: 11,
                                border: '1px solid #e0e0e0',
                                borderRadius: 4,
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* ── Section 0: Table Title ── */}
                  <div>
                    <div style={SECTION_HEADER_STYLE}>
                      Table Title
                    </div>
                    <input
                      type="text"
                      value={tableTitle}
                      onChange={(e) => setTableTitle(e.target.value)}
                      placeholder="Enter table title..."
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: 12,
                        border: '1px solid #e0e0e0',
                        borderRadius: 4,
                        outline: 'none',
                        boxSizing: 'border-box',
                        marginBottom: 8,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, maxWidth: 120 }}>
                      <FontSizeInput label="Size" value={tableTitleFontSize} onChange={setTableTitleFontSize} min={1} max={96} defaultVal={16} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{ fontSize: 11, color: '#6a6a6a', marginRight: 4 }}>Position</label>
                      {(['left', 'center', 'right'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setTableTitlePosition(pos)}
                          style={{
                            padding: '3px 10px',
                            fontSize: 11,
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            background: tableTitlePosition === pos ? '#0777b3' : '#fff',
                            color: tableTitlePosition === pos ? '#fff' : '#333',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                          }}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 1: Column Name Replacements ── */}
                  <div>
                    <div style={SECTION_HEADER_STYLE}>
                      Column Name Replacements
                    </div>
                    {Object.entries(columnNameReplacements).map(([origCol, replacement]) => (
                      <div key={origCol} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#6a6a6a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={origCol}>
                          {origCol}
                        </span>
                        <span style={{ fontSize: 11, color: '#999' }}>→</span>
                        <input
                          type="text"
                          value={replacement}
                          onChange={(e) => setColumnNameReplacements((prev) => ({ ...prev, [origCol]: e.target.value }))}
                          style={{
                            flex: 1,
                            fontSize: 11,
                            padding: '3px 6px',
                            border: '1px solid #e0e0e0',
                            borderRadius: 4,
                            outline: 'none',
                            fontFamily: 'inherit',
                          }}
                        />
                        <button
                          onClick={() => setColumnNameReplacements((prev) => {
                            const next = { ...prev };
                            delete next[origCol];
                            return next;
                          })}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 13,
                            color: '#999',
                            padding: '0 2px',
                            lineHeight: 1,
                          }}
                          title="Remove override"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {/* Add Override dropdown */}
                    {(() => {
                      const availableCols = pivotColumns.filter((c) => !(c in columnNameReplacements));
                      if (availableCols.length === 0) return null;
                      return (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              setColumnNameReplacements((prev) => ({ ...prev, [e.target.value]: '' }));
                            }
                          }}
                          style={{
                            fontSize: 11,
                            padding: '4px 6px',
                            border: '1px solid #d0d0d0',
                            borderRadius: 4,
                            background: '#fff',
                            color: '#0777b3',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            width: '100%',
                          }}
                        >
                          <option value="">+ Add Override...</option>
                          {availableCols.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      );
                    })()}
                  </div>

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Row Limit ── */}
                  <div>
                    <div style={SECTION_HEADER_STYLE}>Row Limit</div>
                    <FontSizeInput label="Rows per page" value={pivotRowLimit} onChange={setPivotRowLimit} min={10} max={5000} defaultVal={100} />
                  </div>

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 2: Font Size ── */}
                  <FontSizePair
                    headerValue={tableHeaderFontSize} dataValue={tableDataFontSize}
                    onHeaderChange={setTableHeaderFontSize} onDataChange={setTableDataFontSize}
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 3: Column Widths ── */}
                  <ColumnWidthSection
                    mode={colWidthMode} setMode={setColWidthMode}
                    maxDataWidth={colWidthMaxData} setMaxDataWidth={setColWidthMaxData}
                    fixedWidth={colWidthFixed} setFixedWidth={setColWidthFixed}
                    overrides={colWidthOverrides} setOverrides={setColWidthOverrides}
                    availableColumns={pivotColumns} radioName="pivotColWidthMode"
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 4: Column Text Formatting ── */}
                  <ColumnTextFormatSection
                    formats={columnTextFormats} setFormats={setColumnTextFormats}
                    availableColumns={pivotColumns}
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 5: Data Formatting ── */}
                  <DataFormatSection
                    globalFmt={dataFormat} setGlobalFmt={setDataFormat}
                    columnFormats={columnDataFormats} setColumnFormats={setColumnDataFormats}
                    availableColumns={pivotColumns}
                  />

                  <div style={{ borderTop: '1px solid #e0e0e0' }} />

                  {/* ── Section 6: Conditional Formatting ── */}
                  <ConditionalFormatSection
                    rules={conditionalFormats} setRules={setConditionalFormats}
                    columns={pivotColumns} idPrefix="cf" nextIdRef={nextIdRef}
                  />

                </div>
              )}
            </div>
          )}

          {/* Tab bar at the very bottom */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            borderTop: '1px solid #e0e0e0',
            background: '#fff',
            flexShrink: 0,
            overflow: 'auto',
          }}>
            {(['setup', 'format'] as const).map(tab => (
              <div
                key={tab}
                onClick={() => setLeftPanelTab(tab)}
                style={{
                  flex: 1,
                  padding: '7px 14px',
                  cursor: 'pointer',
                  fontWeight: leftPanelTab === tab ? 600 : 400,
                  fontSize: 12,
                  color: leftPanelTab === tab ? '#333' : '#6a6a6a',
                  background: leftPanelTab === tab ? '#f0f0f0' : 'transparent',
                  borderBottom: leftPanelTab === tab ? '2px solid #333' : '2px solid transparent',
                  whiteSpace: 'nowrap' as const,
                  userSelect: 'none' as const,
                  textAlign: 'center' as const,
                  transition: 'all 0.15s',
                }}
              >
                {tab === 'setup' ? 'Pivot Setup' : 'Format'}
              </div>
            ))}
          </div>
        </div>}

        {/* ── Resize divider ── */}
        {leftPanelOpen && <div
          onMouseDown={() => {
            panelResizing.current = true;
          }}
          style={{
            width: 3,
            cursor: "col-resize",
            background: "#e0e0e0",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "#0777b3")
          }
          onMouseLeave={(e) => {
            if (!panelResizing.current)
              e.currentTarget.style.background = "#e0e0e0";
          }}
        />}

        {/* ── Main Panel ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            flex: 1,
            overflow: (chartType !== 'table' && !showChartPicker) ? "hidden" : "auto",
            padding: (chartType !== 'table' && !showChartPicker) ? '4px 4px 0 4px' : 16,
            minWidth: 0,
            position: "relative",
            display: (isViewingDashboard || activeTab !== 'pivot') ? "none" : (chartType !== 'table' && !showChartPicker) ? "flex" : undefined,
            flexDirection: (chartType !== 'table' && !showChartPicker) ? "column" as const : undefined,
          }}
        >
          {!hasSource || !canPivot ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "auto",
                padding: (chartType !== 'table' && !showChartPicker) ? '12px 12px 16px 12px' : undefined,
              }}
            >
              <div
                style={{
                  color: "#adadad",
                  fontSize: 16,
                  textAlign: "center",
                  paddingTop: 32,
                  paddingBottom: 16,
                }}
              >
                {!hasSource
                  ? (customSqlExpanded ? "Enter a SQL query in the editor!" : "Select a table from the left panel to get started!")
                  : chartType === 'big-number'
                    ? 'Drag a column into the Values quadrant to display a number!'
                    : 'Drag columns into the Filters, Columns, Rows, and Values quadrants to build a visual!'}
              </div>
              <ChartTypePicker
                activeType={chartType}
                onSelect={(t) => {
                  setChartType(t);
                  if (t === 'big-number') {
                    setRowItems([]);
                    setColumnItems([]);
                  }
                  const newType = t === 'table' ? 'pivot' : 'chart';
                  setTabs(prev => prev.map(tab => {
                    if (tab.id !== currentPivotId) return tab;
                    if (tab.type === newType) return tab;
                    const isPivotLabel = /^Pivot \d+$/.test(tab.label);
                    const isChartLabel = /^Chart \d+$/.test(tab.label);
                    if (isPivotLabel || isChartLabel) {
                      const num = tab.label.match(/\d+$/)?.[0] || '1';
                      return { ...tab, type: newType, label: newType === 'pivot' ? `Pivot ${num}` : `Chart ${num}` };
                    }
                    return { ...tab, type: newType };
                  }));
                }}
              />
            </div>
          ) : isCustomSqlActive && customColsQ.isError ? (
            <div
              style={{
                background: "#fef2f2",
                borderRadius: 6,
                padding: 16,
                color: "#bc1200",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
                Query Error
              </div>
              <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                {customColsQ.error?.message}
              </div>
            </div>
          ) : customSqlEmpty ? (
            <div
              style={{
                background: "#fef2f2",
                borderRadius: 6,
                padding: 16,
                color: "#bc1200",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
                No rows returned by the SQL query.
              </div>
              <div style={{ fontSize: 12 }}>
                Update your SQL to return data.
              </div>
            </div>
          ) : createPivotTempQ.isLoading ||
            (columnItems.length > 0 && colNamesQ.isLoading) ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 8,
                color: "#6a6a6a",
                fontSize: 13,
              }}
            >
              <Loader2 className="animate-spin" size={16} />
              Running pivot query...
            </div>
          ) : (pivotQ.isError || createPivotTempQ.isError) ? (
            <div
              style={{
                background: "#fef2f2",
                borderRadius: 6,
                padding: 16,
                color: "#bc1200",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>
                Query Error
              </div>
              <div style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                {createPivotTempQ.error?.message || pivotQ.error?.message}
              </div>
            </div>
          ) : pivotColumns.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#adadad",
                fontSize: 14,
                gap: 6,
                textAlign: "center",
                padding: 40,
              }}
            >
              {isCustomSqlActive ? (
                <>
                  <div>No rows returned by the SQL query.</div>
                  <div style={{ fontSize: 12 }}>Update your SQL to return data.</div>
                </>
              ) : (
                "No results"
              )}
            </div>
          ) : (
            <div style={{
              overflow: filterPopup ? "visible" : (chartType !== 'table' && !showChartPicker) ? "hidden" : "auto",
              maxHeight: (chartType !== 'table' && !showChartPicker) ? undefined : "100%",
              minHeight: filterPopup ? 420 : undefined,
              display: (chartType !== 'table' && !showChartPicker) ? "flex" : undefined,
              flexDirection: (chartType !== 'table' && !showChartPicker) ? "column" as const : undefined,
              flex: (chartType !== 'table' && !showChartPicker) ? 1 : undefined,
              minWidth: 0,
            }}>
              <div
                style={{
                  fontSize: 11,
                  color: "#6a6a6a",
                  marginBottom: (chartType !== 'table' && !showChartPicker) ? 2 : 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexShrink: 0,
                }}
              >
                {pivotTotalRows > pivotRowLimit ? (
                  <PaginationBar page={pivotPage} totalRows={pivotTotalRows} rowLimit={pivotRowLimit} onPageChange={setPivotPage} />
                ) : (
                  <span>
                    {filteredData.length.toLocaleString()} row
                    {filteredData.length !== 1 ? "s" : ""}
                    {Object.values(tblFilters).some((v) => v != null) &&
                      ` (filtered from ${pivotData.length.toLocaleString()})`}
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
                  <button
                    onClick={() => setShowChartPicker((v) => !v)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: showChartPicker || chartType !== 'table' ? "1px solid #0777b3" : "1px solid #d0d0d0",
                      background: showChartPicker ? "#e8f0f8" : chartType !== 'table' ? "#f0f7fc" : "#fff",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 500,
                      color: showChartPicker || chartType !== 'table' ? "#0777b3" : "#6a6a6a",
                      fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                  >
                    <BarChart3 size={13} />
                    {chartType !== 'table' ? CHART_TYPES.find(t => t.id === chartType)?.label ?? 'Chart' : 'Chart Type'}
                  </button>
                  {chartType === 'table' && (<>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                    <ToggleSwitch checked={showSubtotals} onChange={setShowSubtotals} />
                    <span>Subtotals</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                    <ToggleSwitch checked={showGrandTotals} onChange={setShowGrandTotals} />
                    <span>Grand Total</span>
                  </label>
                  </>)}
                </div>
              </div>
              {showChartPicker ? (
                <ChartTypePicker
                  activeType={chartType}
                  onSelect={(t) => {
                    setChartType(t);
                    if (t === 'big-number') {
                      setRowItems([]);
                      setColumnItems([]);
                    }
                    setShowChartPicker(false);
                    // Update tab type and label when switching between table and chart
                    const newType = t === 'table' ? 'pivot' : 'chart';
                    setTabs(prev => prev.map(tab => {
                      if (tab.id !== currentPivotId) return tab;
                      if (tab.type === newType) return tab;
                      // Preserve user-customized labels by only updating if label matches the default pattern
                      const isPivotLabel = /^Pivot \d+$/.test(tab.label);
                      const isChartLabel = /^Chart \d+$/.test(tab.label);
                      if (isPivotLabel || isChartLabel) {
                        const num = tab.label.match(/\d+$/)?.[0] || '1';
                        return { ...tab, type: newType, label: newType === 'pivot' ? `Pivot ${num}` : `Chart ${num}` };
                      }
                      return { ...tab, type: newType };
                    }));
                  }}
                />
              ) : chartType === 'big-number' ? (
                <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {(() => {
                    // Compute the big number value from the first value column of filtered data
                    const seriesCols = pivotColumns.filter(c => !rowColNamesSet.has(c) && c !== 'value_names');
                    const firstValueCol = seriesCols[0];
                    const numValue = firstValueCol && chartReadyData.length > 0 ? N(chartReadyData[0][firstValueCol]) : 0;
                    const formattedValue = formatBigNumber(numValue, bigNumberAbbreviate, bigNumberDecimalPlaces);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        {bigNumberTitle && bigNumberTitlePosition === 'above' && (
                          <div style={{ fontSize: bigNumberTitleFontSize, color: '#6a6a6a', fontWeight: 500 }}>{bigNumberTitle}</div>
                        )}
                        <div style={{ fontSize: bigNumberFontSize, fontWeight: 700, color: '#231f20', lineHeight: 1.1 }}>
                          {formattedValue}
                        </div>
                        {bigNumberTitle && bigNumberTitlePosition === 'below' && (
                          <div style={{ fontSize: bigNumberTitleFontSize, color: '#6a6a6a', fontWeight: 500 }}>{bigNumberTitle}</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : chartType !== 'table' ? (
                <div style={{ width: '100%', flex: 1, minHeight: 0 }}>
                  <PivotChart
                    chartType={chartType}
                    data={chartReadyData}
                    allColumns={pivotColumns}
                    rowCols={rowColNames}
                    chartTitle={chartTitle}
                    chartTitleFontSize={chartTitleFontSize}
                    chartTitlePosition={chartTitlePosition}
                    dataLabelsEnabled={dataLabelsEnabled}
                    dataLabelsPosition={dataLabelsPosition}
                    dataLabelsFontSize={dataLabelsFontSize}
                    dataLabelsColor={dataLabelsColor}
                    dataLabelsBgColor={dataLabelsBgColor}
                    dataLabelsBold={dataLabelsBold}
                    dataLabelsItalic={dataLabelsItalic}
                    legendEnabled={legendEnabled}
                    legendPosition={legendPosition}
                    legendFontSize={legendFontSize}
                    legendSortOrder={legendSortOrder}
                    sortedSeriesOrder={sortedSeriesCols}
                    colorTheme={colorTheme}
                    markersEnabled={markersEnabled}
                    markerSize={markerSize}
                    markerShapeTheme={markerShapeTheme}
                    markerFill={markerFill}
                    chartLineWidth={chartLineWidth}
                    showLines={showLines}
                    seriesOverrides={seriesOverrides}
                    composedDefaultType={composedDefaultType}
                    composedStacked={composedStacked}
                    chartBarGap={chartBarGap}
                    chartBarCategoryGap={chartBarCategoryGap}
                    xAxisMin={xAxisMin}
                    xAxisMax={xAxisMax}
                    yAxisMin={yAxisMin}
                    yAxisMax={yAxisMax}
                  />
                </div>
              ) : (<>
              {tableTitle && (
                <div style={{
                  textAlign: tableTitlePosition || 'center',
                  fontSize: tableTitleFontSize || 16,
                  fontWeight: 600,
                  color: '#231f20',
                  padding: '0 0 6px',
                }}>
                  {tableTitle}
                </div>
              )}
              <table
                style={{
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  fontSize: tableDataFontSize,
                }}
              >
                <thead>
                  <tr>
                    {pivotColumns.map((col) => (
                      <th
                        key={col}
                        onDoubleClick={() => setPivotSortColumns(prev => cycleSortColumn(prev, col))}
                        style={{
                          width: colWidths[col] || 120,
                          minWidth: 20,
                          textAlign: "left",
                          fontWeight: 600,
                          fontSize: tableHeaderFontSize,
                          padding: "6px 10px",
                          borderBottom: "2px solid #d0d0d0",
                          background: "#fff",
                          position: "sticky",
                          top: 0,
                          whiteSpace: "nowrap",
                          zIndex: filterPopup === col ? 10 : 2,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              flex: 1,
                            }}
                            title={columnNameReplacements[col] || prettyColName(col, columnItems, valueItems, valuesAxis)}
                          >
                            {columnNameReplacements[col] || prettyColName(col, columnItems, valueItems, valuesAxis)}
                          </span>
                          {(() => {
                            const si = pivotSortColumns.findIndex(s => s.col === col);
                            return si !== -1 ? <SortIndicator direction={pivotSortColumns[si].direction} order={si + 1} /> : null;
                          })()}
                          <button
                            data-filter-popup="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterPopup(
                                filterPopup === col ? null : col
                              );
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: 2,
                              cursor: "pointer",
                              color: tblFilters[col] != null
                                ? "#0777b3"
                                : "#adadad",
                              display: "flex",
                              flexShrink: 0,
                              borderRadius: 3,
                            }}
                          >
                            <Filter size={11} />
                          </button>
                        </div>
                        {/* Filter dropdown */}
                        {filterPopup === col && (
                          <ColumnFilterDropdown
                            col={col}
                            pivotData={pivotData}
                            cascadedData={cascadedData}
                            currentSelection={tblFilters[col] ?? null}
                            applyRef={filterApplyRef}
                            onApply={(selected) => {
                              setTblFilters((p) => {
                                const next = { ...p };
                                if (selected === null) {
                                  delete next[col];
                                } else {
                                  next[col] = selected;
                                }
                                return next;
                              });
                              setFilterPopup(null);
                            }}
                            onCancel={() => setFilterPopup(null)}
                          />
                        )}
                        {/* Column resize handle */}
                        <div
                          onMouseDown={(e) => {
                            e.preventDefault();
                            colResizing.current = {
                              col,
                              startX: e.clientX,
                              startW: colWidths[col] || 120,
                            };
                          }}
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: 4,
                            cursor: "col-resize",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#0777b3")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 500).map((row, ri) => {
                    const rowType = (showSubtotals || showGrandTotals) ? getRowType(row) : "normal";
                    const bgColor =
                      rowType === "grand_total"
                        ? "#e0ecf4"
                        : rowType === "subtotal"
                        ? "#eef4f9"
                        : ri % 2 === 0
                        ? "#fff"
                        : "#fafafa";
                    const hoverBg =
                      rowType === "grand_total"
                        ? "#d4e4f0"
                        : rowType === "subtotal"
                        ? "#e2edf5"
                        : "#f5f8fa";
                    return (
                      <tr
                        key={ri}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = hoverBg)
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = bgColor)
                        }
                        style={{
                          background: bgColor,
                          borderBottom: "1px solid #f0f0f0",
                          fontWeight: rowType !== "normal" ? 600 : 400,
                        }}
                      >
                        {pivotColumns.map((col) => {
                          const val = row[col];
                          const isNum =
                            typeof val === "number" ||
                            typeof val === "bigint";
                          const colDataFmt = columnDataFormats[col];
                          const display = formatCellValue(val, dataFormat, colDataFmt);
                          const isDataCell = !rowColNamesSet.has(col) && col !== 'value_names';
                          const fmt = columnTextFormats[col];
                          const condStyle = getConditionalStyle(row, col, conditionalFormats, pivotColTypes);
                          return (
                            <td
                              key={col}
                              onDoubleClick={isDataCell ? () => onCellDoubleClick(row, col) : undefined}
                              style={{
                                padding: "5px 10px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: colWidths[col] || 120,
                                textAlign: fmt?.align || (isNum ? "right" : "left"),
                                fontVariantNumeric: isNum
                                  ? "tabular-nums"
                                  : undefined,
                                cursor: isDataCell ? "pointer" : undefined,
                                ...(fmt ? {
                                  fontWeight: fmt.bold ? 600 : undefined,
                                  fontStyle: fmt.italic ? 'italic' : undefined,
                                  textDecoration: fmt.underline ? 'underline' : undefined,
                                  color: fmt.color || undefined,
                                  background: fmt.bgColor || undefined,
                                } : {}),
                                ...condStyle,
                              }}
                              title={display}
                            >
                              {display}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </>)}
            </div>
          )}
        </div>
        {/* Drilldown tables — all rendered, only active shown */}
        {!isViewingDashboard && drilldownTabs.map(tab => (
          <div key={tab.id} style={{
            flex: 1, display: activeTab === tab.id ? 'flex' : 'none',
            flexDirection: 'column' as const, minHeight: 0,
          }}>
            <DrilldownTable
              sql={tab.sql}
              tableId={tab.id}
              rowLimit={drilldownRowLimit}
              maxRowCount={maxRowCount}
              title={drilldownTitle}
              titleFontSize={drilldownTitleFontSize}
              titlePosition={drilldownTitlePosition}
              headerFontSize={drilldownHeaderFontSize}
              dataFontSize={drilldownDataFontSize}
              columnTextFormats={drilldownColumnTextFormats}
              conditionalFormats={drilldownConditionalFormats}
              colWidthMode={drilldownColWidthMode}
              colWidthMaxData={drilldownColWidthMaxData}
              colWidthFixed={drilldownColWidthFixed}
              colWidthOverrides={drilldownColWidthOverrides}
              setColWidthOverrides={setDrilldownColWidthOverrides}
              dataFormat={drilldownDataFormat}
              columnDataFormats={drilldownColumnDataFormats}
            />
          </div>
        ))}
        {/* Dashboard canvas — shown when a dashboard tab is active */}
        {isViewingDashboard && (
          <DashboardCanvas
            dashboardState={dashboardStates.current[activeTabId] || { tiles: [], nextTileId: 1 }}
            onUpdateState={(s) => { dashboardStates.current[activeTabId] = s; setDashboardRenderKey(k => k + 1); }}
            tabs={tabs}
            selectedTileId={dashboardSelectedTabId ? (dashboardStates.current[activeTabId]?.tiles.find(t => t.tabId === dashboardSelectedTabId)?.id || null) : null}
            onTileClick={(tabId) => {
              setDashboardSelectedTabId(tabId);
              // Load that tab's settings into the left panel state (without actually switching tabs)
              const st = savedTabStates.current[tabId];
              if (st) applyTabState(st);
              // Auto-switch to Format tab so the user can edit the visual
              setLeftPanelTab('format');
            }}
            onDeselectAll={() => {
              // Save live state back before deselecting
              if (dashboardSelectedTabId) {
                savedTabStates.current[dashboardSelectedTabId] = collectTabState();
              }
              setDashboardSelectedTabId(null);
            }}
            renderTileContent={(tabId) => {
              const tab = tabs.find(t => t.id === tabId);
              if (!tab) return <div style={{ color: '#adadad', fontSize: 12, padding: 8 }}>Tab not found</div>;
              // For the selected tile, use live state; for others, use saved state
              const st = tabId === dashboardSelectedTabId ? collectTabState() : savedTabStates.current[tabId];
              if (!st && tab.type !== 'drilldown') return <div style={{ color: '#adadad', fontSize: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Configure this tab first</div>;
              const tileTabState = tab.type === 'drilldown' ? (() => {
                const parentState = savedTabStates.current[tab.parentId!];
                return {
                  sql: tab.sql, chartType: 'table',
                  drilldownTitle: parentState?.drilldownTitle || '',
                  drilldownTitleFontSize: parentState?.drilldownTitleFontSize || 16,
                  drilldownTitlePosition: parentState?.drilldownTitlePosition || 'center',
                };
              })() : st;
              return (
                <DashboardTileContent
                  tabId={tabId}
                  tabState={tileTabState}
                  tabType={tab.type as any}
                />
              );
            }}
          />
        )}
        {/* Tab bar — always visible */}
        <div style={{
          display: 'flex', alignItems: 'center', borderTop: '1px solid #e0e0e0',
          background: '#fff', flexShrink: 0, overflow: 'auto',
        }}>
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            const canClose = tab.type === 'drilldown' || tab.type === 'dashboard' || tabs.filter(t => t.type !== 'drilldown' && t.type !== 'dashboard').length > 1;
            return (
              <div
                key={tab.id}
                data-tab-idx={idx}
                draggable
                onDragStart={(e: any) => { tabDragRef.current = { dragIdx: idx }; e.dataTransfer.setData('text/tab-id', tab.id); }}
                onTouchStart={startTouchTabDrag(idx, tab.id, tab.label)}
                onDragOver={(e: any) => { e.preventDefault(); e.currentTarget.style.borderLeft = '2px solid #0777b3'; }}
                onDragLeave={(e: any) => { e.currentTarget.style.borderLeft = 'none'; }}
                onDrop={(e: any) => {
                  e.currentTarget.style.borderLeft = 'none';
                  if (!tabDragRef.current) return;
                  const fromIdx = tabDragRef.current.dragIdx;
                  tabDragRef.current = null;
                  if (fromIdx === idx) return;
                  setTabs(prev => {
                    const next = [...prev];
                    const [moved] = next.splice(fromIdx, 1);
                    next.splice(fromIdx < idx ? idx - 1 : idx, 0, moved);
                    return next;
                  });
                }}
                onDragEnd={() => { tabDragRef.current = null; }}
                onClick={() => switchToTab(tab.id)}
                style={{
                  padding: '7px 8px 7px 10px', cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 12,
                  color: isActive ? '#333' : '#6a6a6a',
                  background: isActive ? '#f0f7fc' : 'transparent',
                  borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', userSelect: 'none',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: tab.color, flexShrink: 0 }} />
                {tab.type === 'chart' ? <BarChart3 size={18} /> : tab.type === 'pivot' ? <Table2 size={18} /> : tab.type === 'dashboard' ? <LayoutDashboard size={18} /> : null}
                <span>{tab.label}</span>
                {canClose && (
                  <button
                    onClick={(e: any) => { e.stopPropagation(); closeTab(tab.id); }}
                    style={{
                      background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer',
                      color: '#6a6a6a', display: 'flex', borderRadius: 3, lineHeight: 1,
                    }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.color = '#bc1200'; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.color = '#6a6a6a'; }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
          {/* New Pivot Table button */}
          <button
            onClick={() => createPivotTab('pivot')}
            title="New Pivot Table"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 3,
              color: '#6a6a6a', fontSize: 11, borderRadius: 4,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.color = '#333'; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6a6a6a'; }}
          >
            <Plus size={11} strokeWidth={3} />
            <Table2 size={18} />
          </button>
          {/* New Chart button */}
          <button
            onClick={() => createPivotTab('chart')}
            title="New Chart"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 3,
              color: '#6a6a6a', fontSize: 11, borderRadius: 4,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.color = '#333'; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6a6a6a'; }}
          >
            <Plus size={11} strokeWidth={3} />
            <BarChart3 size={18} />
          </button>
          {/* New Dashboard button */}
          <button
            onClick={() => createDashboardTab()}
            title="New Dashboard"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 3,
              color: '#6a6a6a', fontSize: 11, borderRadius: 4,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.color = '#333'; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6a6a6a'; }}
          >
            <Plus size={11} strokeWidth={3} />
            <LayoutDashboard size={18} />
          </button>
          {/* Drop zone for dragging to end */}
          <div
            style={{ flex: 1, minWidth: 24, alignSelf: 'stretch' }}
            onDragOver={(e: any) => { e.preventDefault(); e.currentTarget.style.borderLeft = '2px solid #0777b3'; }}
            onDragLeave={(e: any) => { e.currentTarget.style.borderLeft = 'none'; }}
            onDrop={(e: any) => {
              e.currentTarget.style.borderLeft = 'none';
              if (!tabDragRef.current) return;
              const fromIdx = tabDragRef.current.dragIdx;
              tabDragRef.current = null;
              setTabs(prev => {
                const next = [...prev];
                const [moved] = next.splice(fromIdx, 1);
                next.push(moved);
                return next;
              });
            }}
          />
        </div>
        </div>
      </div>
      {/* Aggregate function dropdown menu */}
      {aggMenuId && aggMenuPos && (() => {
        const item = valueItems.find((v) => v.id === aggMenuId);
        if (!item) return null;
        return (
          <div
            data-agg-menu="true"
            className="agg-dropdown"
            style={{
              position: "fixed",
              top: aggMenuPos.top,
              left: aggMenuPos.left,
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)",
              zIndex: 1000,
              width: 210,
              maxHeight: 320,
              overflowY: "auto" as const,
              padding: "4px 0",
              fontSize: 12,
            }}
          >
            <div
              className="agg-dropdown-item"
              onClick={() => {
                startEdit(aggMenuId, item.expr);
                setAggMenuId(null);
                setAggMenuPos(null);
              }}
              style={{
                padding: "7px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#231f20",
                fontWeight: 500,
              }}
            >
              <Code size={13} style={{ color: "#0777b3", flexShrink: 0 }} />
              Custom
            </div>
            <div style={{ height: 1, background: "#e8e8e8", margin: "4px 0" }} />
            {AGGREGATE_FUNCTIONS.map(({ name, desc }) => (
              <div
                key={name}
                className="agg-dropdown-item"
                title={desc}
                onClick={() => {
                  applyAggregate(aggMenuId, name);
                  setAggMenuId(null);
                  setAggMenuPos(null);
                }}
                style={{
                  padding: "6px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: "#231f20",
                  fontSize: 12,
                }}
              >
                {name}
              </div>
            ))}
          </div>
        );
      })()}
      {/* Date granularity dropdown menu */}
      {dateMenuId && dateMenuPos && (() => {
        const allDims = [...columnItems, ...rowItems];
        const dimItem = allDims.find((d) => d.id === dateMenuId);
        if (!dimItem) return null;
        const quad: 'columns' | 'rows' = columnItems.some(d => d.id === dateMenuId) ? 'columns' : 'rows';
        const dtype = colTypeMap.get(dimItem.col) || '';
        const granOptions = isTimestampLike(dtype) ? TIMESTAMP_GRANULARITIES : DATE_GRANULARITIES;
        return (
          <div
            data-date-menu="true"
            style={{
              position: "fixed",
              top: dateMenuPos.top,
              left: dateMenuPos.left,
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)",
              zIndex: 1000,
              width: 180,
              maxHeight: 280,
              overflowY: "auto" as const,
              padding: "4px 0",
              fontSize: 12,
            }}
          >
            <div style={{ padding: "4px 12px 6px", fontSize: 10, fontWeight: 600, color: "#6a6a6a", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
              Date Granularity
            </div>
            {granOptions.map(({ key, label }) => {
              const isActive = (key || undefined) === dimItem.granularity;
              return (
                <div
                  key={label}
                  className="agg-dropdown-item"
                  onClick={() => {
                    applyGranularity(dateMenuId, quad, key);
                    setDateMenuId(null);
                    setDateMenuPos(null);
                  }}
                  style={{
                    padding: "6px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: isActive ? "#0777b3" : "#231f20",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 12,
                  }}
                >
                  {isActive && <span style={{ marginRight: 6, fontSize: 11 }}>&#10003;</span>}
                  {label}
                </div>
              );
            })}
          </div>
        );
      })()}
      {/* ── Chat floating button ─────────────────────────────────── */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          style={{
            position: 'fixed', bottom: 20, right: 20, zIndex: 9998,
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0777b3', color: '#fff', border: 'none',
            borderRadius: 24, padding: '10px 18px', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e: any) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.22)'; }}
          onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'; }}
        >
          <HelpCircle size={18} />
          Chat to build visuals!
        </button>
      )}
      {/* ── Chat panel ───────────────────────────────────────────── */}
      {chatOpen && (
        <ChatPanel
          messages={chatMessages}
          input={chatInput}
          onInputChange={setChatInput}
          onSend={() => {
            const q = chatInput.trim();
            if (!q || chatProcessing) return;
            addChatMessage('user', q);
            setChatInput('');
            runChatFlow(q);
          }}
          onClear={() => {
            chatAbortRef.current?.abort();
            setChatMessages([]);
            setChatExpandedIds(new Set());
            setChatProcessing(false);
          }}
          onClose={() => setChatOpen(false)}
          width={chatPanelWidth}
          height={chatPanelHeight}
          onResizeStart={(e: any) => {
            chatResizing.current = {
              startX: e.clientX, startY: e.clientY,
              startW: chatPanelWidth, startH: chatPanelHeight,
            };
          }}
          expandedIds={chatExpandedIds}
          onToggleExpand={(id: number) => {
            setChatExpandedIds(prev => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            });
          }}
          isProcessing={chatProcessing}
        />
      )}
      {/* Touch drag ghost overlay — always mounted, hidden by default, positioned via DOM */}
      <div
        ref={touchGhostRef}
        style={{
          display: 'none',
          position: 'fixed',
          transform: 'translate(-50%, -120%)',
          background: '#0777b3',
          color: '#fff',
          padding: '4px 10px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          pointerEvents: 'none',
          zIndex: 10000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      />
    </div>
  );
}

