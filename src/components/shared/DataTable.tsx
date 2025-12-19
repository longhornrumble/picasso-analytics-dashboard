/**
 * DataTable Component (Generic)
 * Reusable table with search, pagination, and configurable columns
 *
 * Used by: Forms Dashboard, Conversations Dashboard, Attribution Dashboard
 */

import React, { useState } from 'react';

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
}

interface DataTableProps<T extends object> {
  /** Title displayed in header */
  title: string;
  /** Subtitle/description */
  subtitle?: string;
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
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Show actions column */
  showActions?: boolean;
  /** Actions menu render function */
  renderActions?: (row: T) => React.ReactNode;
  /** Empty state message */
  emptyMessage?: string;
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
  onRowClick,
  showActions = true,
  renderActions,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalCount);

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
            {/* Filter button */}
            {showFilter && (
              <button
                onClick={onFilter}
                className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${
                    column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'
                  } ${column.width || ''}`}
                >
                  {column.header}
                </th>
              ))}
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
                  colSpan={columns.length + (showActions ? 1 : 0)}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={String((row as Record<string, unknown>)[rowKey as string])}
                  className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 ${column.width || ''} ${
                        column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : ''
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
 * Helper: Truncated text cell
 * Use for long text fields like comments
 */
export function TruncatedCell({
  text,
  maxWidth = '200px',
}: {
  text: string;
  maxWidth?: string;
}) {
  return (
    <p
      className="text-sm text-gray-600 truncate"
      style={{ maxWidth }}
      title={text}
    >
      {text}
    </p>
  );
}
