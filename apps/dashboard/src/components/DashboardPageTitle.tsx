"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "../i18n/context";
import { dashboardPageTitle } from "../lib/page-title";

export function DashboardPageTitle() {
  const pathname = usePathname();
  const { t } = useI18n();
  const title = dashboardPageTitle(pathname, t);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
