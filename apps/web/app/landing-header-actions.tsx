"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function LandingHeaderActions() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/session/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (
          active
          && typeof body === "object"
          && body !== null
          && "signedIn" in body
          && body.signedIn === true
        ) {
          setSignedIn(true);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return signedIn ? (
    <Link className="kd-button kd-button--neutral" href="/app">Dashboard</Link>
  ) : (
    <>
      <Link href="/login">Log in</Link>
      <Link className="kd-button kd-button--neutral" href="/signup">Sign up</Link>
    </>
  );
}
