"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@keydrop/ui";
import CustomerAppRail from "./customer-app-rail";
import CustomerWorkspaceLoading from "./customer-workspace-loading";
import SignOutButton from "./sign-out-button";

function getWorkspaceTitle(pathname: string): string {
  if (pathname.startsWith("/app/secrets")) return "Secrets";
  if (pathname.startsWith("/app/requests")) return "Requests";
  return "Overview";
}

export default function CustomerWorkspaceShell({
  children,
  email,
}: {
  children: ReactNode;
  email?: string;
}) {
  const pathname = usePathname();
  const currentPath = pathname || "/app";
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTarget = useRef<{ pathname: string; currentPathname: string } | null>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startNavigation(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || !(event.target instanceof Element)
    ) {
      return;
    }

    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

    const destination = new URL(anchor.href, window.location.href);
    if (
      destination.origin !== window.location.origin
      || !destination.pathname.startsWith("/app")
      || (destination.pathname === window.location.pathname && destination.search === window.location.search)
    ) {
      return;
    }

    navigationTarget.current = {
      pathname: destination.pathname,
      currentPathname: window.location.pathname,
    };
    setIsNavigating(true);
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = setTimeout(() => {
      navigationTarget.current = null;
      setIsNavigating(false);
    }, destination.pathname === window.location.pathname ? 450 : 2_000);
  }

  useEffect(() => {
    const target = navigationTarget.current;
    if (!isNavigating || !target || pathname !== target.pathname || target.pathname === target.currentPathname) {
      return;
    }

    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = setTimeout(() => {
      navigationTarget.current = null;
      setIsNavigating(false);
    }, 450);
    return () => {
      if (navigationTimer.current) clearTimeout(navigationTimer.current);
    };
  }, [isNavigating, pathname]);

  return (
    <div
      className="kd-app-layout kd-customer-app"
      data-page={currentPath === "/app" ? "overview" : undefined}
      onClickCapture={startNavigation}
    >
      <aside className="kd-app-sidebar">
        <CustomerAppRail currentPath={currentPath} />
      </aside>
      <div className="kd-app-main">
        <header className="kd-app-toolbar kd-customer-toolbar">
          <div className="kd-customer-toolbar-start">
            <CustomerAppRail currentPath={currentPath} mobile />
            <span className="kd-customer-toolbar-title">{getWorkspaceTitle(currentPath)}</span>
          </div>
          <div className="kd-customer-toolbar-account">
            {email && currentPath !== "/app" ? (
              <Link className="kd-customer-email" href="/app" title="Open account overview">
                {email}
              </Link>
            ) : null}
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        {isNavigating ? <CustomerWorkspaceLoading /> : children}
      </div>
    </div>
  );
}
