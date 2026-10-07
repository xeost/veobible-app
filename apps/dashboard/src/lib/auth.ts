import { cookies } from "next/headers";
import { db, bindings } from "./env";
import { signToken, verifyToken } from "./jwt";
export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: "admin" | "editor";
}
export async function currentUser(token?: string): Promise<User | null> {
  const value = token ?? (await cookies()).get("veo_session")?.value;
  if (!value) return null;
  const payload = await verifyToken(value, bindings().JWT_SECRET);
  if (!payload) return null;
  return db()
    .prepare(
      "SELECT id,username,name,email,role FROM dashboard_users WHERE id=? AND auth_version=? AND active=1",
    )
    .bind(payload.userId, payload.authVersion)
    .first<User>();
}

export async function createUserToken(userId: number) {
  const user = await db()
    .prepare("SELECT auth_version FROM dashboard_users WHERE id=? AND active=1")
    .bind(userId)
    .first<{ auth_version: number }>();
  if (!user) throw new Error("User unavailable");
  return signToken(userId, user.auth_version, bindings().JWT_SECRET);
}
