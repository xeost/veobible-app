import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { profileSchema, saveProfile, ProfileError } from "./profile";
import { passwordHash, verifyPassword } from "./security";
test("profile updates normalize usernames and protect passwords and other sessions", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(
    readFileSync(
      new URL("../../migrations/0001_dashboard.sql", import.meta.url),
      "utf8",
    ),
  );
  const user = {
    id: "one",
    username: "editor",
    name: "Original",
    email: "",
    role: "editor" as const,
  };
  const originalHash = await passwordHash("original-password");
  sqlite
    .prepare(
      "INSERT INTO users(id,username,name,password_hash,role) VALUES (?,?,?,?,?)",
    )
    .run(user.id, user.username, user.name, originalHash, user.role);
  sqlite
    .prepare(
      "INSERT INTO users(id,username,name,password_hash,role) VALUES ('two','taken','Other',?,'admin')",
    )
    .run(originalHash);
  sqlite
    .prepare("INSERT INTO sessions VALUES (?, 'one', ?)")
    .run("current", Date.now() + 60_000);
  sqlite
    .prepare("INSERT INTO sessions VALUES (?, 'one', ?)")
    .run("other", Date.now() + 60_000);
  type Statement = {
    query: string;
    parameters: unknown[];
    bind: (...values: unknown[]) => Statement;
    first: <T>() => Promise<T | null>;
  };
  const prepare = (query: string): Statement => {
    const statement: Statement = {
      query,
      parameters: [],
      bind(...values) {
        return {
          ...statement,
          parameters: values,
          first: async <T>() =>
            (sqlite
              .prepare(query)
              .get(...(values as (string | number | null)[])) as
              T | undefined) ?? null,
        };
      },
      first: async <T>() =>
        (sqlite.prepare(query).get() as T | undefined) ?? null,
    };
    return statement;
  };
  const database = {
    prepare,
    batch: async (
      statements: Parameters<Parameters<typeof saveProfile>[0]["batch"]>[0],
    ) => {
      sqlite.exec("BEGIN");
      try {
        for (const statement of statements as Statement[])
          sqlite
            .prepare(statement.query!)
            .run(...(statement.parameters! as (string | number | null)[]));
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  const fields = {
    username: " New.Editor ",
    name: " New name ",
    email: "editor@example.com",
  };
  const updated = await saveProfile(
    database,
    user,
    profileSchema.parse(fields),
    "current",
  );
  assert.equal(updated.username, "new.editor");
  assert.equal(updated.name, "New name");
  assert.equal(
    sqlite.prepare("SELECT password_hash FROM users WHERE id='one'").get()
      ?.password_hash,
    originalHash,
  );
  await assert.rejects(
    saveProfile(
      database,
      updated,
      profileSchema.parse({ ...fields, username: "TAKEN" }),
      "current",
    ),
    (error: unknown) => error instanceof ProfileError && error.status === 409,
  );
  await assert.rejects(
    saveProfile(
      database,
      updated,
      profileSchema.parse({
        ...fields,
        currentPassword: "wrong",
        password: "replacement-password",
      }),
      "current",
    ),
    /Contraseña actual incorrecta/,
  );
  assert.equal(
    sqlite.prepare("SELECT count(*) total FROM sessions").get()?.total,
    2,
  );
  await saveProfile(
    database,
    updated,
    profileSchema.parse({
      ...fields,
      currentPassword: "original-password",
      password: "replacement-password",
    }),
    "current",
  );
  const hash = sqlite
    .prepare("SELECT password_hash FROM users WHERE id='one'")
    .get()?.password_hash as string;
  assert.equal(await verifyPassword("replacement-password", hash), true);
  assert.equal(await verifyPassword("original-password", hash), false);
  assert.deepEqual(
    sqlite
      .prepare("SELECT token_hash FROM sessions")
      .all()
      .map((s) => s.token_hash),
    ["current"],
  );
  assert.throws(() =>
    profileSchema.parse({
      ...fields,
      password: "short",
      currentPassword: "original-password",
    }),
  );
  assert.throws(() =>
    profileSchema.parse({ ...fields, password: "replacement-password" }),
  );
  assert.throws(() => profileSchema.parse({ ...fields, username: "x" }));
  sqlite.close();
});
