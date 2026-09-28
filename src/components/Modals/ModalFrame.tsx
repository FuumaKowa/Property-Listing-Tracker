import React, { useLayoutEffect, useId, useRef } from "react";
import { X } from "lucide-react";
export function ModalFrame({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previous;
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="property-dialog modal-panel"
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          close.current();
      }}
    >
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-5 sm:px-7">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-500"
        >
          <X size={18} />
        </button>
        <h2
          id={titleId}
          className="pr-10 text-xl font-bold tracking-tight text-slate-800"
        >
          {title}
        </h2>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="px-5 py-6 sm:px-7">{children}</div>
    </dialog>
  );
}
