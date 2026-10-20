// Fallback for environments where `supabase start` can't pull every image
// (e.g. registry rate limits). Runs alongside `supabase db start` plus a bare
// PostgREST container and exposes it at http://127.0.0.1:54321/rest/v1 so
// supabase-js works unchanged. Prints a service-role key for .env.local.
//
//   docker run -d --name pio_rest --network supabase_network_pio-coverage-hq \
//     -p 54329:3000 -e PGRST_DB_URI=postgres://authenticator:postgres@supabase_db_pio-coverage-hq:5432/postgres \
//     -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
//     -e PGRST_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long \
//     postgrest/postgrest:v16.4
//   node scripts/dev/rest-proxy.mjs
import http from "node:http";
import { SignJWT } from "jose";

const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const UPSTREAM = { host: "127.0.0.1", port: 54329 };
const PORT = 54321;

const key = await new SignJWT({ role: "service_role" })
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setIssuedAt()
  .setExpirationTime("10y")
  .sign(new TextEncoder().encode(SECRET));

http
  .createServer((req, res) => {
    if (!req.url?.startsWith("/rest/v1")) {
      res.writeHead(404).end();
      return;
    }
    const upstream = http.request(
      { ...UPSTREAM, method: req.method, path: req.url.slice("/rest/v1".length) || "/", headers: req.headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on("error", () => res.writeHead(502).end());
    req.pipe(upstream);
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`REST proxy on http://127.0.0.1:${PORT}/rest/v1`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY=${key}`);
  });
