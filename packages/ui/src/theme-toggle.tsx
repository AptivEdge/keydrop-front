"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "./components/ui/button";

function subscribeToMount() {
  return () => {};
}

function getMountedSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeToMount, getMountedSnapshot, getServerSnapshot);
  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark
        ? <Sun aria-hidden="true" data-icon="inline-start" />
        : <Moon aria-hidden="true" data-icon="inline-start" />}
    </Button>
  );
}
