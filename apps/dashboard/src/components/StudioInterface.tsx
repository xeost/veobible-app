"use client";

import type { ReactNode } from "react";
import type { User } from "../lib/auth";
import { ToastProvider } from "./ToastProvider";
import { Shell } from "./Shell";

export default function StudioInterface({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <Shell user={user}>{children}</Shell>
    </ToastProvider>
  );
}
