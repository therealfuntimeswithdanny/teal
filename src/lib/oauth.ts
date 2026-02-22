import { BrowserOAuthClient } from "@atproto/oauth-client-browser";

const DEFAULT_HANDLE_RESOLVER = "https://bsky.social";

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

const runtimeOrigin = typeof window !== "undefined"
  ? window.location.origin
  : "https://teal-stats.madebydanny.uk";

export const APP_ORIGIN = trimTrailingSlash(import.meta.env.VITE_APP_ORIGIN || runtimeOrigin);
export const ATPROTO_OAUTH_ORIGIN = trimTrailingSlash(
  import.meta.env.VITE_ATPROTO_OAUTH_ORIGIN || APP_ORIGIN
);
export const ATPROTO_ALLOWED_RETURN_ORIGINS = (
  import.meta.env.VITE_ATPROTO_ALLOWED_RETURN_ORIGINS || APP_ORIGIN
)
  .split(",")
  .map((origin) => trimTrailingSlash(origin.trim()))
  .filter(Boolean);

const DEFAULT_CLIENT_ID = `${ATPROTO_OAUTH_ORIGIN}/oauth/client-metadata.json`;

export const ATPROTO_CLIENT_ID = import.meta.env.VITE_ATPROTO_CLIENT_ID || DEFAULT_CLIENT_ID;
const HANDLE_RESOLVER = import.meta.env.VITE_ATPROTO_HANDLE_RESOLVER || DEFAULT_HANDLE_RESOLVER;

let clientPromise: Promise<BrowserOAuthClient> | null = null;

export function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (!clientPromise) {
    clientPromise = BrowserOAuthClient.load({
      clientId: ATPROTO_CLIENT_ID,
      handleResolver: HANDLE_RESOLVER,
    });
  }
  return clientPromise;
}
