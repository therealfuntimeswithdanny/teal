import { BrowserOAuthClient } from "@atproto/oauth-client-browser";

const DEFAULT_CLIENT_ID = "https://teal-stats.madebydanny.uk/oauth/client-metadata.json";
const DEFAULT_HANDLE_RESOLVER = "https://bsky.social";

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
