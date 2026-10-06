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
        message: "Escribe tu contraseña actual.",
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
  sessionHash: string,
): Promise<User> {
  const username = input.username ?? user.username;
  const duplicate = await database
    .prepare("SELECT id FROM users WHERE username=? AND id<>?")
    .bind(username, user.id)
    .first<{ id: string }>();
  if (duplicate)
    throw new ProfileError(
      "Ese nombre de usuario ya está en uso. Elige otro.",
      409,
    );
  let hash: string | undefined;
  if (input.password) {
    const row = await database
      .prepare("SELECT password_hash FROM users WHERE id=?")
      .bind(user.id)
      .first<{ password_hash: string }>();
    if (
      !row ||
      !(await verifyPassword(input.currentPassword ?? "", row.password_hash))
    )
      throw new ProfileError("Contraseña actual incorrecta", 400);
    hash = await passwordHash(input.password);
  }
  const statements = [
    database
      .prepare(
        "UPDATE users SET username=?,name=?,email=?,password_hash=COALESCE(?,password_hash) WHERE id=?",
      )
      .bind(username, input.name, input.email, hash ?? null, user.id),
  ];
  if (hash)
    statements.push(
      database
        .prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?")
        .bind(user.id, sessionHash),
    );
  try {
    await database.batch(statements);
  } catch (error) {
    if (/UNIQUE.*users.username/i.test(String(error)))
      throw new ProfileError(
        "Ese nombre de usuario ya está en uso. Elige otro.",
        409,
      );
    throw error;
  }
  return { ...user, username, name: input.name, email: input.email };
}
