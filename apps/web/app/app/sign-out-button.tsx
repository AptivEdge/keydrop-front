"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@keydrop/ui";

export default function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    setError("");
    try {
      const csrfResponse = await fetch("/api/session/csrf", { cache: "no-store" });
      const csrfData: unknown = await csrfResponse.json();
      if (
        !csrfResponse.ok
        || typeof csrfData !== "object"
        || csrfData === null
        || !("token" in csrfData)
        || typeof csrfData.token !== "string"
      ) {
        throw new Error("Could not start a secure sign-out. Refresh and try again.");
      }

      const response = await fetch("/api/session/logout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfData.token,
        },
        body: "{}",
      });
      const result: unknown = await response.json();
      if (
        !response.ok
        && !(typeof result === "object" && result !== null && "ok" in result && result.ok === true)
      ) {
        throw new Error("Could not complete sign-out. Try again.");
      }

      const warning = typeof result === "object"
        && result !== null
        && "warning" in result
        && typeof result.warning === "string";
      router.push(warning ? "/login?session=logout-warning" : "/login");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete sign-out. Try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="kd-account-sign-out">
      <Button variant="outline" onClick={signOut} disabled={isSigningOut}>
        {isSigningOut ? "Signing out…" : "Sign out"}
      </Button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
