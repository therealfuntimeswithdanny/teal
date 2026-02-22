import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

function accountInitial(label: string): string {
  const trimmed = label.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

export default function AuthAccountMenu({ lastSyncedAt }: { lastSyncedAt?: string | null }) {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    sessionDid,
    activeAccount,
    accounts,
    hasOAuthSession,
    switchAccount,
    removeAccount,
    signOut,
  } = useAuth();

  const subtitle = useMemo(() => {
    if (!isAuthenticated || !sessionDid) return "Not connected";
    const handle = activeAccount?.handle;
    if (handle) return handle;
    return `${sessionDid.slice(0, 18)}…`;
  }, [activeAccount?.handle, isAuthenticated, sessionDid]);

  if (!isAuthenticated || !sessionDid) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-9 w-9">
            <AvatarImage src={activeAccount?.avatar} alt={activeAccount?.displayName ?? subtitle} />
            <AvatarFallback>{accountInitial(activeAccount?.displayName ?? subtitle)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {activeAccount?.displayName ?? "Signed in"}
            </p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-2 w-2 rounded-full ${hasOAuthSession ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-xs text-muted-foreground">
            {hasOAuthSession ? "Connected" : "Profile mode"}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">Account</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Current account</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate(`/user/${encodeURIComponent(sessionDid)}`)}>
                My history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/user/${encodeURIComponent(sessionDid)}/stats`)}>
                My stats
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Switch account</DropdownMenuLabel>
              {accounts.length === 0 &&
              <DropdownMenuItem disabled>No saved accounts</DropdownMenuItem>
              }
              {accounts.map((account) =>
              <DropdownMenuItem key={account.did} onClick={() => switchAccount(account.did)}>
                  <span className="truncate">
                    {account.handle ?? account.displayName ?? account.did}
                  </span>
                  {account.did === sessionDid && <span className="ml-auto text-xs text-muted-foreground">active</span>}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => removeAccount(sessionDid)}>
                Forget current account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void signOut()}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>DID: {sessionDid.slice(0, 22)}…</span>
        {lastSyncedAt && <span>Last sync {new Date(lastSyncedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}
