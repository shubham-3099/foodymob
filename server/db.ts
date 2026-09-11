export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}
export type Env = {
  DB: Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  ADMIN_EMAILS?: string;
  PAYMENT_SERVICE_SECRET?: string;
  PAYMENT_SERVICE_URL?: string;
  PAYMENTS_MODE?: string;
  LOCAL_AUTH?: (request: Request) => Promise<import('./auth.ts').User | null>;
};
export const one = <T = Record<string, unknown>>(db: Database, sql: string, ...args: unknown[]) =>
  db
    .prepare(sql)
    .bind(...args)
    .first<T>();
export const all = async <T = Record<string, unknown>>(
  db: Database,
  sql: string,
  ...args: unknown[]
) =>
  (
    await db
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
export const run = (db: Database, sql: string, ...args: unknown[]) =>
  db
    .prepare(sql)
    .bind(...args)
    .run();
export const now = () => Date.now();
export const uid = () => crypto.randomUUID();
