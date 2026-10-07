"use client";

import React, { ReactNode } from "react";
import { AlertTriangle, Trash2, ShieldAlert, CheckCircle2, Info, X } from "lucide-react";

export type AlertVariant = "danger" | "warning" | "info" | "success";

export interface CustomAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message?: string | ReactNode;
  variant?: AlertVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  isProcessing?: boolean;
}

export function CustomAlertDialog({
  isOpen,
  onClose,
  title,
  message,
  variant = "info",
  confirmText = "OK",
  cancelText,
  onConfirm,
  isProcessing = false,
}: CustomAlertDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: <Trash2 className="h-6 w-6 text-rose-600" />,
          iconBg: "bg-rose-50 border-rose-200 text-rose-600",
          glow: "from-rose-500/10",
          confirmBtn: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 focus:ring-rose-500",
          tagText: "Destructive Action",
          tagColor: "bg-rose-50 text-rose-700 border-rose-200",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
          iconBg: "bg-amber-50 border-amber-200 text-amber-600",
          glow: "from-amber-500/10",
          confirmBtn: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200 focus:ring-amber-500",
          tagText: "Attention Required",
          tagColor: "bg-amber-50 text-amber-700 border-amber-200",
        };
      case "success":
        return {
          icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />,
          iconBg: "bg-emerald-50 border-emerald-200 text-emerald-600",
          glow: "from-emerald-500/10",
          confirmBtn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 focus:ring-emerald-500",
          tagText: "System Success",
          tagColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
      case "info":
      default:
        return {
          icon: <ShieldAlert className="h-6 w-6 text-orange-600" />,
          iconBg: "bg-orange-50 border-orange-200 text-orange-600",
          glow: "from-orange-500/10",
          confirmBtn: "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200 focus:ring-orange-500",
          tagText: "System Notice",
          tagColor: "bg-orange-50 text-orange-700 border-orange-200",
        };
    }
  };

  const vStyle = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Subtle Ambient Top Accent Glow */}
        <div className={`absolute top-0 inset-x-0 h-16 bg-gradient-to-b ${vStyle.glow} to-transparent pointer-events-none`} />

        {/* Close Icon Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 relative">
          <div className="flex items-start space-x-4">
            {/* Semantic Icon Pill */}
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center border shrink-0 ${vStyle.iconBg} shadow-xs`}
            >
              {vStyle.icon}
            </div>

            {/* Header Content */}
            <div className="flex-1 pr-4 min-w-0">
              <div className="flex items-center space-x-2 mb-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${vStyle.tagColor}`}>
                  {vStyle.tagText}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {title}
              </h3>
              {message && (
                <div className="text-xs text-slate-500 mt-2 leading-relaxed break-words">
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          {cancelText && (
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-xs transition flex items-center space-x-1.5 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${vStyle.confirmBtn}`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
