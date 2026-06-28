"use client";

/**
 * Travora Modal — reusable popup with backdrop blur and close button.
 * Used for upgrade prompts, confirmations, and focused overlay content.
 */

import { useEffect } from "react";

/**
 * @param {object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {() => void} props.onClose - Called when backdrop or close button is clicked
 * @param {string} [props.title] - Optional modal heading
 * @param {React.ReactNode} props.children - Modal body content
 * @param {string} [props.className=""] - Additional classes for the panel
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* Backdrop — blurred overlay, click to dismiss */}
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-navy/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        className={`modal-enter relative z-10 w-full max-w-md rounded-xl border border-outline-variant/30 bg-white p-6 shadow-[var(--shadow-modal)] ${className}`}
      >
        {/* Header row with title and close button */}
        <div className="mb-4 flex items-start justify-between gap-4">
          {title && (
            <h2
              id="modal-title"
              className="text-xl font-semibold tracking-tight text-navy"
            >
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto cursor-pointer rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-navy-light hover:text-navy"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
