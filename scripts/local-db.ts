import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import type { Database, Statement } from "../server/db.ts";
export function localDatabase(filename = ":memory:"): Database & { close: () => void } {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;");
  class Query implements Statement {
    sql: string;
    values: unknown[];
    constructor(sql: string, values: unknown[] = []) {
      this.sql = sql;
      this.values = values;
    }
    bind(...values: unknown[]) {
      return new Query(this.sql, values);
    }
    async first<T>() {
      return (db.prepare(this.sql).get(...(this.values as any[])) ?? null) as T | null;
    }
    async all<T>() {
      return { results: db.prepare(this.sql).all(...(this.values as any[])) as T[] };
    }
    async run() {
      const r = db.prepare(this.sql).run(...(this.values as any[]));
      return { meta: { changes: Number(r.changes) } };
    }
  }
  db.exec("CREATE TABLE IF NOT EXISTS __local_migrations(name TEXT PRIMARY KEY)");
  for (const name of readdirSync("drizzle")
    .filter((n) => n.endsWith(".sql"))
    .sort())
    if (!db.prepare("SELECT name FROM __local_migrations WHERE name=?").get(name)) {
      db.exec("BEGIN");
      try {
        db.exec(readFileSync("drizzle/" + name, "utf8"));
        db.prepare("INSERT INTO __local_migrations VALUES(?)").run(name);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
  return {
    prepare: (sql: string) => new Query(sql),
    async batch(queries) {
      db.exec("BEGIN");
      try {
        const out = [];
        // Execute synchronously inside this SQLite transaction: awaiting each
        // statement would allow a concurrent request to open a nested transaction.
        for (const q of queries) {
          const query = q as Query;
          const result = db.prepare(query.sql).run(...(query.values as any[]));
          out.push({ meta: { changes: Number(result.changes) } });
        }
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => db.close(),
  };
}
