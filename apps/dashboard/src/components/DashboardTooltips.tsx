"use client";

import { useEffect } from "react";
import { tooltipPosition } from "../lib/tooltip-position";

/** One floating tooltip serves the entire dashboard, including native modal dialogs. */
export function DashboardTooltips() {
  useEffect(() => {
    const tooltip = document.createElement("div");
    tooltip.id = "dashboard-tooltip";
    tooltip.className = "dashboard-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.setAttribute("popover", "manual");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    let active: HTMLElement | null = null;
    let hovered: HTMLElement | null = null;
    let focused: HTMLElement | null = null;
    let openTimer: ReturnType<typeof setTimeout> | undefined;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    const detachDescription = () => {
      if (!active) return;
      const ids = (active.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter((id) => id && id !== tooltip.id);
      if (ids.length) active.setAttribute("aria-describedby", ids.join(" "));
      else active.removeAttribute("aria-describedby");
    };
    const hide = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      detachDescription();
      active = null;
      if (tooltip.matches(":popover-open")) tooltip.hidePopover();
      tooltip.hidden = true;
    };
    const position = () => {
      if (!active?.isConnected) return hide();
      const view = window.visualViewport;
      const viewport = {
        left: view?.offsetLeft ?? 0,
        top: view?.offsetTop ?? 0,
        width: view?.width ?? window.innerWidth,
        height: view?.height ?? window.innerHeight,
      };
      tooltip.style.maxWidth = `${Math.max(1, Math.min(320, viewport.width - 20))}px`;
      tooltip.style.maxHeight = `${Math.max(1, viewport.height - 20)}px`;
      const placement = tooltipPosition(
        active.getBoundingClientRect(),
        tooltip.getBoundingClientRect(),
        viewport,
      );
      tooltip.style.left = `${placement.left}px`;
      tooltip.style.top = `${placement.top}px`;
      tooltip.style.setProperty("--tooltip-arrow", `${placement.arrow}px`);
      tooltip.dataset.side = placement.side;
    };
    const text = (element: HTMLElement) =>
      element.dataset.tooltip ??
      element.getAttribute("aria-label") ??
      element.querySelector("svg[aria-label]")?.getAttribute("aria-label") ??
      "";
    const trigger = (target: EventTarget | null) => {
      if (!(target instanceof Element) || tooltip.contains(target)) return null;
      const explicit = target.closest<HTMLElement>("[data-tooltip]");
      if (explicit) return text(explicit).trim() ? explicit : null;
      const icon = target.closest<HTMLElement>('button, a, [role="button"]');
      return icon && !icon.textContent?.trim() && text(icon).trim()
        ? icon
        : null;
    };
    const show = (element: HTMLElement) => {
      clearTimeout(closeTimer);
      if (active === element) return;
      hide();
      active = element;
      openTimer = setTimeout(() => {
        if (!element.isConnected || active !== element) return hide();
        const label = text(element).trim();
        if (!label) return hide();
        tooltip.textContent = label;
        tooltip.hidden = false;
        // The browser's top layer stays above dialogs, stacking contexts and clipped containers.
        tooltip.showPopover();
        position();
        const ids = new Set(
          (element.getAttribute("aria-describedby") ?? "")
            .split(/\s+/)
            .filter(Boolean),
        );
        ids.add(tooltip.id);
        element.setAttribute("aria-describedby", [...ids].join(" "));
      }, 220);
    };
    const scheduleHide = () => {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (focused?.isConnected) show(focused);
        else hide();
      }, 120);
    };
    const pointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (tooltip.contains(event.target as Node))
        return clearTimeout(closeTimer);
      const element = trigger(event.target);
      hovered = element;
      if (element) show(element);
    };
    const pointerOut = (event: PointerEvent) => {
      const next =
        event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (next && (tooltip.contains(next) || hovered?.contains(next))) return;
      hovered = null;
      scheduleHide();
    };
    const focusIn = (event: FocusEvent) => {
      focused = trigger(event.target);
      if (focused) show(focused);
      else hide();
    };
    const focusOut = () => {
      focused = null;
      scheduleHide();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const dismiss = () => {
      hovered = null;
      focused = null;
      hide();
    };
    const refresh = () => {
      if (!active || tooltip.hidden) return;
      const label = text(active).trim();
      if (!label) return hide();
      if (tooltip.textContent !== label) tooltip.textContent = label;
      position();
    };
    // Convert native titles supplied by embedded players as well as future controls.
    const convertTitles = (root: Element) => {
      const elements = [...root.querySelectorAll<HTMLElement>("[title]")];
      if (root instanceof HTMLElement && root.hasAttribute("title"))
        elements.push(root);
      for (const element of elements) {
        const title = element.getAttribute("title");
        if (title) element.dataset.tooltip = title;
        element.removeAttribute("title");
      }
    };
    convertTitles(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.attributeName === "title")
          convertTitles(record.target as Element);
        for (const node of record.addedNodes)
          if (node instanceof Element && node !== tooltip) convertTitles(node);
      }
      refresh();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title", "data-tooltip", "aria-label"],
    });
    document.addEventListener("pointerover", pointerOver);
    document.addEventListener("pointerout", pointerOut);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", escape);
    document.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", refresh);
    window.addEventListener("blur", dismiss);
    window.visualViewport?.addEventListener("resize", refresh);
    window.visualViewport?.addEventListener("scroll", refresh);
    return () => {
      observer.disconnect();
      hide();
      tooltip.remove();
      document.removeEventListener("pointerover", pointerOver);
      document.removeEventListener("pointerout", pointerOut);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("blur", dismiss);
      window.visualViewport?.removeEventListener("resize", refresh);
      window.visualViewport?.removeEventListener("scroll", refresh);
    };
  }, []);
  return null;
}
