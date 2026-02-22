import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const appOrigin = trimTrailingSlash(
  process.env.VITE_APP_ORIGIN || "https://teal-stats.madebydanny.uk"
);
const oauthOrigin = trimTrailingSlash(
  process.env.VITE_ATPROTO_OAUTH_ORIGIN || appOrigin
);

const clientId = process.env.VITE_ATPROTO_CLIENT_ID || `${oauthOrigin}/oauth/client-metadata.json`;
const redirectUri = process.env.VITE_ATPROTO_REDIRECT_URI || `${oauthOrigin}/oauth/callback`;

const metadata = {
  client_id: clientId,
  client_name: "teal.fm stats",
  client_uri: oauthOrigin,
  logo_uri: `${oauthOrigin}/favicon.ico`,
  redirect_uris: [redirectUri],
  scope: "atproto transition:generic",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  application_type: "web",
  token_endpoint_auth_method: "none",
  dpop_bound_access_tokens: true,
};

const outputPath = resolve(process.cwd(), "public/oauth/client-metadata.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

console.log(`[oauth] wrote ${outputPath}`);
console.log(`[oauth] client_id=${clientId}`);
console.log(`[oauth] redirect_uri=${redirectUri}`);
