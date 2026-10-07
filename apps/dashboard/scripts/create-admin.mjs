import { randomUUID, pbkdf2Sync } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
const username = process.env.DASHBOARD_ADMIN_USERNAME;
const password = process.env.DASHBOARD_ADMIN_PASSWORD;
if (
  !username ||
  !/^[a-zA-Z0-9_.-]{3,60}$/.test(username) ||
  !password ||
  password.length < 12
)
  throw new Error(
    "Set DASHBOARD_ADMIN_USERNAME and DASHBOARD_ADMIN_PASSWORD (12+ characters)",
  );
const salt = randomUUID();
const hash = `pbkdf2:100000:${salt}:${pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("hex")}`;
const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const file = path.resolve("imports/admin.sql");
await fs.mkdir(path.dirname(file), { recursive: true });
await fs.writeFile(
  file,
  `INSERT INTO dashboard_users(username,name,email,password_hash,role) VALUES (${[username, process.env.DASHBOARD_ADMIN_NAME ?? username, process.env.DASHBOARD_ADMIN_EMAIL ?? "", hash, "admin"].map(q).join(",")}) ON CONFLICT(username) DO NOTHING;\n`,
  { mode: 0o600 },
);
console.log(
  `Created ${file}. Apply with wrangler d1 execute DB --local --file imports/admin.sql. Existing users are never overwritten.`,
);
