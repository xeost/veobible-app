import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth";
import { BibleVersions } from "../../../components/BibleVersions";
export default async function BibleVersionsPage() {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/");
  return <BibleVersions />;
}
