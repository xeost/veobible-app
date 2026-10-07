import { z } from "zod";
import type { User } from "./auth";
import { passwordHash, verifyPassword } from "./security";
export const profileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_.-]{3,60}$/)
      .optional(),
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().or(z.literal("")),
    currentPassword: z.string().max(256).optional(),
    password: z.string().min(12).max(256).optional(),
  })
  .superRefine((value, context) => {
    if (value.password && !value.currentPassword)
      context.addIssue({
        code: "custom",
        message: "Enter your current password.",
        path: ["currentPassword"],
      });
  });
export class ProfileError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
}
interface ProfileDatabase {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}
export async function saveProfile(
  database: ProfileDatabase,
  user: User,
  input: z.infer<typeof profileSchema>,
): Promise<User> {
  const username = input.username ?? user.username;
  const duplicate = await database
    .prepare("SELECT id FROM dashboard_users WHERE username=? AND id<>?")
    .bind(username, user.id)
    .first<{ id: number }>();
  if (duplicate)
    throw new ProfileError(
      "This username is already in use. Choose another one.",
      409,
    );
  let hash: string | undefined;
  if (input.password) {
    const row = await database
      .prepare("SELECT password_hash FROM dashboard_users WHERE id=?")
      .bind(user.id)
      .first<{ password_hash: string }>();
    if (
      !row ||
      !(await verifyPassword(input.currentPassword ?? "", row.password_hash))
    )
      throw new ProfileError("Incorrect current password", 400);
    hash = await passwordHash(input.password);
  }
  const statements = [
    database
      .prepare(
        "UPDATE dashboard_users SET username=?,name=?,email=?,password_hash=COALESCE(?,password_hash),auth_version=auth_version+CASE WHEN ? IS NULL THEN 0 ELSE 1 END WHERE id=?",
      )
      .bind(
        username,
        input.name,
        input.email,
        hash ?? null,
        hash ?? null,
        user.id,
      ),
  ];
  try {
    await database.batch(statements);
  } catch (error) {
    if (/UNIQUE.*dashboard_users.username/i.test(String(error)))
      throw new ProfileError(
        "This username is already in use. Choose another one.",
        409,
      );
    throw error;
  }
  return { ...user, username, name: input.name, email: input.email };
}
