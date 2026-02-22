export interface AuthAccount {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  lastUsedAt: string;
}

const ACCOUNTS_KEY = "teal.auth.accounts.v1";
const ACTIVE_DID_KEY = "teal.auth.active-did.v1";
const PENDING_HANDLE_KEY = "teal.auth.pending-handle.v1";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sortAccounts(accounts: AuthAccount[]): AuthAccount[] {
  return [...accounts].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

export function loadAuthAccounts(): AuthAccount[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AuthAccount[];
    if (!Array.isArray(parsed)) return [];
    return sortAccounts(parsed.filter((account) => Boolean(account?.did)));
  } catch {
    return [];
  }
}

export function saveAuthAccounts(accounts: AuthAccount[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(sortAccounts(accounts)));
}

export function upsertAuthAccount(
  accounts: AuthAccount[],
  input: Omit<AuthAccount, "lastUsedAt"> & { lastUsedAt?: string }
): AuthAccount[] {
  const lastUsedAt = input.lastUsedAt ?? new Date().toISOString();
  const next = accounts.filter((account) => account.did !== input.did);
  next.push({
    ...input,
    lastUsedAt,
  });
  return sortAccounts(next);
}

export function removeAuthAccount(accounts: AuthAccount[], did: string): AuthAccount[] {
  return sortAccounts(accounts.filter((account) => account.did !== did));
}

export function loadActiveDid(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(ACTIVE_DID_KEY);
}

export function saveActiveDid(did: string | null): void {
  if (!canUseStorage()) return;
  if (did) {
    window.localStorage.setItem(ACTIVE_DID_KEY, did);
  } else {
    window.localStorage.removeItem(ACTIVE_DID_KEY);
  }
}

export function loadPendingHandle(): string | null {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(PENDING_HANDLE_KEY);
}

export function savePendingHandle(handle: string): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PENDING_HANDLE_KEY, handle);
}

export function clearPendingHandle(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(PENDING_HANDLE_KEY);
}
