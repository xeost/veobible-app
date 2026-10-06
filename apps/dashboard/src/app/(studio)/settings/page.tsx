import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth";
import { SocialSettings } from "../../../components/SocialSettings";
export default async function SettingsPage() {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/");
  return <SocialSettings />;
}
