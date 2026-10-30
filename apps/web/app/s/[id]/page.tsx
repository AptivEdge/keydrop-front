import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import RecipientSecret from "./recipient-secret";

export const metadata: Metadata = {
  title: "A secret was shared with you",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function RecipientPage({
  params,
}: PageProps<"/s/[id]">) {
  await connection();
  return (
    <Suspense fallback={<RecipientLoading />}>
      <RecipientRoute params={params} />
    </Suspense>
  );
}

async function RecipientRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecipientSecret id={id} />;
}

function RecipientLoading() {
  return (
    <main className="kd-recipient-page">
      <header className="kd-recipient-header">
        <span className="kd-recipient-wordmark">
          <span aria-hidden="true" className="kd-recipient-mark" />
          Keydrop
        </span>
        <span className="kd-recipient-secure">Encrypted in your browser</span>
      </header>
      <div className="kd-recipient-content">
        <div className="kd-recipient-card kd-card" aria-busy="true">
          <div className="kd-recipient-skeleton-mark" />
          <div className="kd-recipient-skeleton-line" />
          <div className="kd-recipient-skeleton-copy" />
          <div className="kd-recipient-skeleton-action" />
        </div>
      </div>
    </main>
  );
}
