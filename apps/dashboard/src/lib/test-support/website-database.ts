import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
export function websiteDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../../../migrations/", import.meta.url);
  const queries: string[] = [];
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(new URL(name, dir), "utf8"));
  const prepare = (sql: string) => {
    queries.push(sql);
    let args: any[] = [];
    const stmt = {
      bind(...v: any[]) {
        args = v;
        return stmt;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...args) };
      },
      async first() {
        return sqlite.prepare(sql).get(...args) ?? null;
      },
      async run() {
        const statement = sqlite.prepare(sql);
        if (statement.columns().length)
          return { results: statement.all(...args), meta: { changes: 0 } };
        return { results: [], meta: statement.run(...args) };
      },
    };
    return stmt;
  };
  return {
    sqlite,
    queries,
    db: {
      prepare,
      batch: async (ss: any[]) => Promise.all(ss.map((s) => s.run())),
    } as unknown as D1Database,
  };
}
