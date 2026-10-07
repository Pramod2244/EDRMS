"use client";

import React from "react";
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Calculate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (safeTotalPages <= maxVisible) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 1);
      let end = Math.min(safeTotalPages, currentPage + 1);

      if (currentPage <= 2) {
        end = 3;
      } else if (currentPage >= safeTotalPages - 1) {
        start = safeTotalPages - 2;
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < safeTotalPages) {
        if (end < safeTotalPages - 1) pages.push("...");
        pages.push(safeTotalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-slate-200 text-xs text-slate-600 select-none shrink-0">
      {/* Entries Info */}
      <div className="flex items-center space-x-2">
        <span>
          Showing <span className="font-semibold text-slate-900">{startItem}</span> to{" "}
          <span className="font-semibold text-slate-900">{endItem}</span> of{" "}
          <span className="font-semibold text-slate-900">{totalItems}</span> entries
        </span>

        {onPageSizeChange && (
          <div className="flex items-center space-x-1.5 ml-4 pl-4 border-l border-slate-200">
            <span className="text-slate-500">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center space-x-1">
        {/* First Page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title="First Page"
          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        {/* Previous Page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center space-x-1 px-1">
          {getPageNumbers().map((p, idx) =>
            typeof p === "number" ? (
              <button
                key={`page-${p}`}
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 rounded-md font-semibold text-xs transition ${
                  currentPage === p
                    ? "bg-orange-500 text-white shadow-2xs"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ) : (
              <span key={`dots-${idx}`} className="px-1 text-slate-400 font-bold">
                {p}
              </span>
            )
          )}
        </div>

        {/* Next Page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= safeTotalPages}
          title="Next Page"
          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last Page */}
        <button
          onClick={() => onPageChange(safeTotalPages)}
          disabled={currentPage >= safeTotalPages}
          title="Last Page"
          className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
