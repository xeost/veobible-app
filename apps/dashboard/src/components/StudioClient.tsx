"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import type { User } from "../lib/auth";

// Studio data is fetched by the browser. Avoid rendering the shell and every
// interactive page a second time on the Worker's small CPU budget.
const Studio = dynamic(() => import("./StudioInterface"), { ssr: false });

export function StudioClient(props: { user: User; children: ReactNode }) {
  return <Studio {...props} />;
}
