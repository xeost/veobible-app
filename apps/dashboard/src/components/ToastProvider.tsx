"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { useI18n } from "../i18n/context";

type Variant = "success" | "error" | "info";
type Toast = { id: number; message: string; variant: Variant };
type Notify = (message: string, variant?: Variant) => void;
const ToastContext = createContext<Notify | null>(null);
export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("ToastProvider is missing");
  return notify;
}
function ToastItem({
  toast,
  dismiss,
}: {
  toast: Toast;
  dismiss: (id: number) => void;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(
    toast.variant === "error"
      ? 8000
      : t(toast.message).length > 160
        ? 10000
        : 5000,
  );
  useEffect(() => {
    if (hovered || focused) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [toast.id, hovered, focused, dismiss]);
  const Icon =
    toast.variant === "success"
      ? CheckCircle2
      : toast.variant === "error"
        ? CircleAlert
        : Info;
  return (
    <li
      className={`toast toast-${toast.variant}`}
      role={toast.variant === "error" ? "alert" : "status"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <Icon size={20} aria-hidden="true" />
      <span>{t(toast.message)}</span>
      <button
        type="button"
        aria-label={t("Dismiss notification")}
        onClick={() => dismiss(toast.id)}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const nextId = useRef(0);
  const notify = useCallback<Notify>((message, variant = "success") => {
    if (!message.trim()) return;
    const toast = { id: ++nextId.current, message, variant };
    setToasts((current) =>
      [
        ...current.filter(
          (item) => item.message !== message || item.variant !== variant,
        ),
        toast,
      ].slice(-4),
    );
  }, []);
  const dismiss = useCallback(
    (id: number) =>
      setToasts((current) => current.filter((item) => item.id !== id)),
    [],
  );
  useEffect(() => {
    if (!toasts.length) {
      setHost(null);
      return;
    }
    // Native modal dialogs are in the top layer and make the rest of the body inert.
    const updateHost = () =>
      setHost(
        Array.from(
          document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
        ).at(-1) ?? document.body,
      );
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    return () => observer.disconnect();
  }, [toasts.length]);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      {host &&
        createPortal(
          <ol className="toast-region" aria-label={t("Notifications")}>
            {toasts.map((toast) => (
              <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
            ))}
          </ol>,
          host,
        )}
    </ToastContext.Provider>
  );
}
