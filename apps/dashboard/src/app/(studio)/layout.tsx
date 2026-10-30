import { redirect } from "next/navigation";
import { currentUser } from "../../lib/auth";
import { StudioClient } from "../../components/StudioClient";
import type { ReactNode } from "react";
export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <StudioClient user={user}>{children}</StudioClient>;
}
