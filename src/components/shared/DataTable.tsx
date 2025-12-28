/**
 * DataTable Component (Generic)
 * Reusable table with search, pagination, and configurable columns
 *
 * Used by: Forms Dashboard, Conversations Dashboard, Attribution Dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Width class (e.g., 'w-32', 'max-w-[200px]') */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom render function for the cell */
  render?: (row: T) => React.ReactNode;
  /** If no render, use this field from the row object */
  field?: keyof T;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Key to use for sorting (defaults to field or key) */
  sortKey?: string;
  /** Whether this column contains numeric data (enables tabular-nums, right-align) */
  isNumeric?: boolean;
}

interface DataTableProps<T extends object> {
  /** Title displayed in header */
  title: string;
  /** Subtitle/description */
  subtitle?: React.ReactNode;
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows */
  data: T[];
  /** Unique key field in data */
  rowKey: keyof T;
  /** Total count for pagination (may differ from data.length) */
  totalCount: number;
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  pageSize: number;
  /** Page change handler */
  onPageChange: (page: number) => void;
  /** Search handler */
  onSearch?: (query: string) => void;
  /** Show search input */
  showSearch?: boolean;
  /** Show filter button */
  showFilter?: boolean;
  /** Filter click handler */
  onFilter?: () => void;
  /** Custom filter component (replaces default filter button) */
  filterComponent?: React.ReactNode;
  /** Current sort column key */
  sortColumn?: string | null;
  /** Current sort direction */
  sortDirection?: SortDirection;
  /** Sort change handler */
  onSort?: (column: string, direction: SortDirection) => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Show actions column */
  showActions?: boolean;
  /** Actions menu render function */
  renderActions?: (row: T) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
  /** Enable column reordering via drag and drop */
  reorderable?: boolean;
  /** Callback when columns are reordered */
  onColumnReorder?: (columnKeys: string[]) => void;
}

export function DataTable<T extends object>({
  title,
  subtitle,
  columns,
  data,
  rowKey,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onSearch,
  showSearch = true,
  showFilter = true,
  onFilter,
  filterComponent,
  sortColumn = null,
  sortDirection = null,
  onSort,
  onRowClick,
  showActions = true,
  renderActions,
  emptyMessage = 'No data available',
  reorderable = false,
  onColumnReorder,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

  // Column reordering state
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map(c => c.key));
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Sync column order when columns prop changes
  useEffect(() => {
    const newKeys = columns.map(c => c.key);
    setColumnOrder(prev => {
      // Keep existing order for columns that still exist, add new ones at the end
      const existingOrder = prev.filter(key => newKeys.includes(key));
      const newColumns = newKeys.filter(key => !prev.includes(key));
      return [...existingOrder, ...newColumns];
    });
  }, [columns]);

  // Get ordered columns based on current order
  const orderedColumns = columnOrder
    .map(key => columns.find(c => c.key === key))
    .filter((c): c is Column<T> => c !== undefined);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const renderCell = (column: Column<T>, row: T): React.ReactNode => {
    if (column.render) {
      return column.render(row);
    }
    if (column.field) {
      const value = (row as Record<string, unknown>)[column.field as string];
      return String(value ?? '');
    }
    return null;
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, columnKey: string) => {
    setDraggedColumn(columnKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnKey);
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = '0.5';
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnKey !== draggedColumn) {
      setDragOverColumn(columnKey);
    }
  }, [draggedColumn]);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const sourceKey = e.dataTransfer.getData('text/plain');

    if (sourceKey && sourceKey !== targetKey) {
      setColumnOrder(prev => {
        const newOrder = [...prev];
        const sourceIndex = newOrder.indexOf(sourceKey);
        const targetIndex = newOrder.indexOf(targetKey);

        if (sourceIndex !== -1 && targetIndex !== -1) {
          // Remove source and insert at target position
          newOrder.splice(sourceIndex, 1);
          newOrder.splice(targetIndex, 0, sourceKey);

          // Notify parent
          onColumnReorder?.(newOrder);
        }

        return newOrder;
      });
    }

    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [onColumnReorder]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            {showSearch && (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent w-48"
                />
                <svg
                  className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}
            {/* Filter button or custom filter component */}
            {showFilter && (
              filterComponent || (
                <button
                  onClick={onFilter}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {orderedColumns.map((column) => {
                const sortKey = column.sortKey || (column.field as string) || column.key;
                const isSorted = sortColumn === sortKey;
                const isAsc = isSorted && sortDirection === 'asc';
                const isDesc = isSorted && sortDirection === 'desc';
                const isDragging = draggedColumn === column.key;
                const isDragOver = dragOverColumn === column.key;

                const handleSortClick = () => {
                  if (!column.sortable || !onSort) return;
                  // Cycle: null -> asc -> desc -> null
                  let newDirection: SortDirection;
                  if (!isSorted || sortDirection === null) {
                    newDirection = 'asc';
                  } else if (sortDirection === 'asc') {
                    newDirection = 'desc';
                  } else {
                    newDirection = null;
                  }
                  onSort(sortKey, newDirection);
                };

                return (
                  <th
                    key={column.key}
                    draggable={reorderable}
                    onDragStart={reorderable ? (e) => handleDragStart(e, column.key) : undefined}
                    onDragEnd={reorderable ? handleDragEnd : undefined}
                    onDragOver={reorderable ? (e) => handleDragOver(e, column.key) : undefined}
                    onDragLeave={reorderable ? handleDragLeave : undefined}
                    onDrop={reorderable ? (e) => handleDrop(e, column.key) : undefined}
                    className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider transition-all ${
                      column.isNumeric ? 'text-right' :
                      column.align === 'right' ? 'text-right' :
                      column.align === 'center' ? 'text-center' : 'text-left'
                    } ${column.width || ''} ${column.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''} ${
                      reorderable ? 'cursor-grab active:cursor-grabbing' : ''
                    } ${isDragging ? 'opacity-50' : ''} ${
                      isDragOver ? 'bg-primary-50 border-l-2 border-primary-400' : ''
                    }`}
                    onClick={handleSortClick}
                  >
                    <span className="inline-flex items-center gap-1">
                      {reorderable && (
                        <svg
                          className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                        </svg>
                      )}
                      {column.header}
                      {column.sortable && (
                        <span className="inline-flex flex-col ml-1">
                          <svg
                            className={`w-3 h-3 -mb-1 ${isAsc ? 'text-primary-600' : 'text-gray-300'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 5l5 5H5l5-5z" />
                          </svg>
                          <svg
                            className={`w-3 h-3 -mt-1 ${isDesc ? 'text-primary-600' : 'text-gray-300'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 15l-5-5h10l-5 5z" />
                          </svg>
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
              {showActions && (
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={orderedColumns.length + (showActions ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={String((row as Record<string, unknown>)[rowKey as string])}
                  className={`
                    ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-[var(--table-stripe-color)]'}
                    hover:bg-[var(--table-hover-color)] transition-colors duration-150
                    ${onRowClick ? 'cursor-pointer' : ''}
                  `}
                  onClick={() => onRowClick?.(row)}
                >
                  {orderedColumns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 ${column.width || ''} ${
                        column.isNumeric ? 'text-right tabular-nums' :
                        column.align === 'right' ? 'text-right' :
                        column.align === 'center' ? 'text-center' : ''
                      }`}
                    >
                      {renderCell(column, row)}
                    </td>
                  ))}
                  {showActions && (
                    <td className="px-6 py-4 text-right">
                      {renderActions ? (
                        renderActions(row)
                      ) : (
                        <button className="text-gray-400 hover:text-gray-600">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {startIndex}-{endIndex} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-200 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 border border-gray-200 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Helper: Badge cell renderer
 * Use in column definitions for consistent badge styling
 */
export function BadgeCell({
  value,
  colorMap,
  defaultColor = 'bg-gray-100 text-gray-700',
}: {
  value: string;
  colorMap?: Record<string, string>;
  defaultColor?: string;
}) {
  const color = colorMap?.[value] || defaultColor;
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${color}`}>
      {value}
    </span>
  );
}

/**
 * Helper: Two-line cell renderer
 * Use for name + email style cells
 */
export function TwoLineCell({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">{primary}</p>
      <p className="text-xs text-gray-500">{secondary}</p>
    </div>
  );
}

/**
 * Helper: Truncated text cell with hover tooltip
 * Use for long text fields like comments
 * Tooltip automatically positions above or below based on available space
 */
export function TruncatedCell({
  text,
  maxWidth = '200px',
}: {
  text: string;
  maxWidth?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showAbove, setShowAbove] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Only show tooltip if text is actually truncated
  const isTruncated = text && text.length > 20;

  const handleMouseEnter = () => {
    if (!isTruncated || !containerRef.current) return;

    // Get element position relative to viewport
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const spaceAbove = rect.top;
    const spaceBelow = viewportHeight - rect.bottom;

    // Show tooltip above if:
    // - There's enough space above (>150px for tooltip)
    // - AND not enough space below (<300px accounts for tooltip height + rows below + footer)
    // Otherwise default to showing below
    const shouldShowAbove = spaceAbove > 150 && spaceBelow < 300;
    setShowAbove(shouldShowAbove);
    setShowTooltip(true);
  };

  if (!text) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <p
        className="text-sm text-gray-600 truncate cursor-default"
        style={{ maxWidth }}
      >
        {text}
      </p>

      {/* Styled tooltip on hover - position based on available space */}
      {showTooltip && (
        <div
          className={`absolute z-50 left-0 max-w-sm animate-in fade-in duration-150 ${
            showAbove ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {/* Tooltip arrow - points toward the text */}
          {showAbove ? (
            <div className="absolute left-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
          ) : (
            <div className="absolute left-4 bottom-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-gray-900" />
          )}
          <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg">
            <p className="whitespace-pre-wrap break-words">{text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
