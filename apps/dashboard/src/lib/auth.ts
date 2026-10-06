import { cookies } from "next/headers";
import { db } from "./env";
import { digest } from "./security";
export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "admin" | "editor";
}
export async function currentUser(token?: string): Promise<User | null> {
  const value = token ?? (await cookies()).get("veo_session")?.value;
  if (!value) return null;
  return db()
    .prepare(
      "SELECT u.id,u.username,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1",
    )
    .bind(await digest(value), Date.now())
    .first<User>();
}
