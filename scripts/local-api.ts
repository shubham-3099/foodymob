import type { Plugin } from "vite";
import { mkdirSync } from "node:fs";
import { api } from "../server/index.ts";
import { localDatabase } from "./local-db.ts";
import {seedCommunitySamples} from './sample-community.ts';
import {migrateCommunity} from './community-migration.ts';
import {communityApi} from '../server/community.ts';
import {locationApi,imageApi} from './community-services.ts';
import { testAuth } from './test-auth.ts';
import { loadEnv } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
export function localApi(): Plugin {
  return {
    name: "dish-api",
    configureServer(server) {
      mkdirSync(".local", { recursive: true });
      const db = localDatabase(".local/fullstack.sqlite");
      const config = loadEnv('development', process.cwd(), '');
      const credentialPath = '.local/admin.json';
      if (!existsSync(credentialPath)) writeFileSync(credentialPath, JSON.stringify({phone:'919999999999',password:randomBytes(18).toString('base64url')}, null, 2), {mode:0o600});
      const defaults=JSON.parse(readFileSync(credentialPath,'utf8'));
      const auth = testAuth(db,config["LOCAL_ADMIN_PHONE"] || defaults.phone,config["LOCAL_ADMIN_PASSWORD"] || defaults.password);
      server.config.logger.info('Local admin credentials: .local/admin.json (or LOCAL_ADMIN_* overrides in .env).');
      const env = {
        DB: db,
        ADMIN_EMAILS: "seedy@sites.test",
        PAYMENTS_MODE: "test",
        PAYMENT_SERVICE_SECRET: "local-development-secret-not-valid-in-production",
        LOCAL_AUTH: async (request: Request) => (await auth).current(request),
      };
      const ready = auth.then(async () => {await migrateCommunity(db);await seedCommunitySamples(db);});
      // Keep read/validate/write operations atomic across local HTTP requests.
      let pending: Promise<unknown> = Promise.resolve();
      function serial<T>(operation: () => Promise<T>): Promise<T> {
        const result = pending.then(operation);
        pending = result.catch(() => {});
        return result;
      }
      server.httpServer?.once("close", () => db.close());
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/") && req.url !== "/ads.txt") return next();
        try {
          await ready;
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > (req.url?.startsWith('/api/community/images') ? 4*1024*1024 : 20000)) {
              res.statusCode = 413;
              res.end("Request too large");
              return;
            }
            chunks.push(Buffer.from(chunk));
          }
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers))
            if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
          const request = new Request("http://" + req.headers.host + req.url, {
            method: req.method ?? "GET",
            headers,
            ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
          });
          const path = new URL(request.url).pathname;
          const response = await serial(async () => path.startsWith('/api/auth/') || path === '/api/newsletter'
            ? await (await auth).handle(request)
            : path.startsWith('/api/community/images') ? await imageApi(request,env)
            : path.startsWith('/api/location/') ? await locationApi(request,env,config['GEOCODER_URL'] || 'https://photon.komoot.io')
            : path.startsWith('/api/community') ? await communityApi(request,env)
            : await api(request, env));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end("Unable to complete request");
        }
      });
    },
  };
}
