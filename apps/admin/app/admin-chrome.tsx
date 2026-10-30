"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Blocks,
  ClipboardList,
  CreditCard,
  FileClock,
  Flag,
  Gauge,
  KeyRound,
  ListChecks,
  LogOut,
  MailCheck,
  Search,
  Settings2,
  Shield,
  Users,
  UsersRound,
} from "lucide-react";
import {
  AppRail,
  AppShell,
  Button,
  Input,
  ThemeToggle,
  UserAvatar,
} from "@keydrop/ui";
import { canAccessAdminSection } from "./admin-data";
import type { AdminRole, StaffIdentity } from "../lib/admin-user";

const navigation = [
  {
    label: "Monitor",
    items: [
      { label: "Overview", href: "/", icon: Gauge, section: "overview" },
      {
        label: "System health",
        href: "/system",
        icon: Activity,
        section: "system",
      },
      {
        label: "Notifications",
        href: "/deliverability",
        icon: MailCheck,
        section: "deliverability",
      },
    ],
  },
  {
    label: "Customers",
    items: [
      { label: "Users", href: "/users", icon: Users, section: "users" },
      { label: "Teams", href: "/teams", icon: UsersRound, section: "teams" },
      {
        label: "Billing",
        href: "/billing",
        icon: CreditCard,
        section: "billing",
      },
      {
        label: "Data requests",
        href: "/data-requests",
        icon: ClipboardList,
        section: "data-requests",
      },
      {
        label: "Secrets lookup",
        href: "/secrets",
        icon: KeyRound,
        section: "secrets",
      },
    ],
  },
  {
    label: "Trust and safety",
    items: [
      { label: "Abuse queue", href: "/abuse", icon: Flag, section: "abuse" },
      {
        label: "Blocklists",
        href: "/blocklists",
        icon: Blocks,
        section: "blocklists",
      },
    ],
  },
  {
    label: "Control",
    items: [
      {
        label: "Approvals",
        href: "/approvals",
        icon: ListChecks,
        section: "approvals",
      },
      {
        label: "Plans and flags",
        href: "/billing?view=plans",
        icon: Settings2,
        section: "billing",
      },
      {
        label: "Announcements",
        href: "/announcements",
        icon: Bell,
        section: "announcements",
      },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Audit log", href: "/audit", icon: FileClock, section: "audit" },
      {
        label: "Admin users",
        href: "/admins",
        icon: Shield,
        section: "admins",
      },
    ],
  },
];

function navigationForRole(role: AdminRole) {
  return navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        canAccessAdminSection(item.section, role),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function PreviewBanner() {
  const configuredEnvironment = process.env.NEXT_PUBLIC_ADMIN_ENVIRONMENT;
  const environment =
    configuredEnvironment === "production" ||
    configuredEnvironment === "staging"
      ? configuredEnvironment
      : "local";
  const label =
    environment === "local"
      ? "LOCAL PREVIEW"
      : `${environment.toUpperCase()} ENVIRONMENT`;

  return (
    <div
      className={`ad-preview-banner ad-preview-banner--${environment}`}
      role="status"
    >
      <Shield aria-hidden="true" />
      <span>
        {label} · Staff session active · API data appears only where an
        authorized endpoint is available
      </span>
    </div>
  );
}

function AdminToolbar({ user }: { user: StaffIdentity }) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.key === "/" &&
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement) &&
        !(target instanceof HTMLElement && target.isContentEditable)
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const csrfResponse = await fetch("/api/admin/csrf", {
        cache: "no-store",
      });
      const csrfData: unknown = await csrfResponse.json();
      if (
        !csrfResponse.ok ||
        typeof csrfData !== "object" ||
        csrfData === null ||
        !("token" in csrfData) ||
        typeof csrfData.token !== "string"
      ) {
        router.replace("/login?reason=logout");
        return;
      }
      const response = await fetch("/api/admin/session/logout", {
        method: "POST",
        headers: { "x-csrf-token": csrfData.token },
      });
      const data: unknown = await response.json();
      const warning =
        typeof data === "object" && data !== null && "warning" in data;
      router.replace(warning ? "/login?reason=logout" : "/login");
    } catch {
      router.replace("/login?reason=logout");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <div className="ad-toolbar-leading">
        <div className="ad-mobile-navigation">
          <AppRail
            groups={navigationForRole(user.role)}
            currentPath={pathname}
            mobile
          />
        </div>
        {user.role === "ADM" && (
          <form
            className="ad-global-search"
            role="search"
            onSubmit={submitSearch}
          >
            <Search aria-hidden="true" />
            <Input
              ref={inputRef}
              aria-label="Search Keydrop users by email or ID"
              placeholder="Search users by email or ID"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <span className="ad-search-shortcut" aria-hidden="true">
              /
            </span>
          </form>
        )}
      </div>
      <div className="ad-toolbar-meta">
        <ThemeToggle />
        <span className="ad-environment-pill">
          {(process.env.NEXT_PUBLIC_ADMIN_ENVIRONMENT ?? "local").toUpperCase()}
        </span>
        <span className="ad-session-note">Authenticated staff session</span>
        <div
          className="ad-preview-user"
          aria-label={`Signed in as ${user.email}`}
        >
          <UserAvatar name={user.email} />
          <span className="ad-preview-user-name">
            <span>{user.email}</span>
            <span>{user.role} · API verified</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="small"
          disabled={signingOut}
          onClick={() => void signOut()}
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

export function AdminChrome({
  children,
  user,
}: Readonly<{ children: React.ReactNode; user: StaffIdentity }>) {
  return (
    <Suspense
      fallback={
        <div className="ad-app" aria-busy="true">
          <div className="ad-preview-banner">
            Loading authenticated workspace…
          </div>
        </div>
      }
    >
      <AdminChromeContent user={user}>{children}</AdminChromeContent>
    </Suspense>
  );
}

function AdminChromeContent({
  children,
  user,
}: Readonly<{ children: React.ReactNode; user: StaffIdentity }>) {
  const pathname = usePathname();

  return (
    <div className="ad-app">
      {/* <PreviewBanner /> */}
      <AppShell
        className="ad-workspace"
        rail={
          <AppRail
            groups={navigationForRole(user.role)}
            currentPath={pathname}
          />
        }
        header={<AdminToolbar user={user} />}
      >
        {children}
      </AppShell>
    </div>
  );
}
