import { ToastProvider } from "../../components/ToastProvider";
import { redirect } from "next/navigation";
import { currentUser } from "../../lib/auth";
import { Shell } from "../../components/Shell";
import type { ReactNode } from "react";
export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <ToastProvider>
      <Shell user={user}>{children}</Shell>
    </ToastProvider>
  );
}
