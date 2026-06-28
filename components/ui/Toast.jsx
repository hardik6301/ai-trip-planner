"use client";

/**
 * Travora Toast — notification system with success, error, and info variants.
 * Auto-dismisses after 3 seconds; renders stacked toasts in the top-right corner.
 * Wrap your app in ToastProvider and call useToast() to show notifications.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/** Visual styles per toast variant */
const VARIANT_STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

/** Icons per toast variant (Material Symbols) */
const VARIANT_ICONS = {
  success: "check_circle",
  error: "error",
  info: "info",
};

const ToastContext = createContext(null);

/**
 * Single toast notification item — auto-dismisses via useEffect timer.
 * @param {object} props
 * @param {string} props.id - Unique toast id
 * @param {string} props.message - Message to display
 * @param {"success"|"error"|"info"} props.variant - Toast type
 * @param {() => void} props.onDismiss - Called when toast is removed
 */
function ToastItem({ id, message, variant, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 3000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      role="alert"
      className={`toast-enter flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${VARIANT_STYLES[variant]}`}
    >
      <span className="material-symbols-outlined shrink-0 text-[20px]">
        {VARIANT_ICONS[variant]}
      </span>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="cursor-pointer shrink-0 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

/**
 * Fixed container that stacks all active toasts in the top-right corner.
 */
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 p-4">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem {...toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

/**
 * Provider — mount once in layout to enable useToast() anywhere in the tree.
 * @param {object} props
 * @param {React.ReactNode} props.children - App content
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, variant = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * Hook — returns showToast(message, variant) to trigger notifications.
 * @returns {{ showToast: (message: string, variant?: "success"|"error"|"info") => void }}
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

/** Alias for ToastProvider — use in root layout as <Toaster> */
export function Toaster({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}

/** Standalone Toast export for direct rendering without the provider */
export default function Toast({
  message,
  variant = "info",
  onDismiss,
  id = "standalone",
}) {
  return (
    <ToastItem
      id={id}
      message={message}
      variant={variant}
      onDismiss={() => onDismiss?.(id)}
    />
  );
}
