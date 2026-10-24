import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth";
import { Settings } from "../../../components/Settings";
export default async function SettingsPage() {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/");
  return <Settings />;
}
