import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Alert } from "@keydrop/ui";
import { parsePublicSecretRequest } from "../../../lib/secret-request-contracts";
import { requestBackend } from "../../../lib/session-api";
import RequestResponder from "./request-responder";

export const instant = false;
export const metadata: Metadata = {
  title: "Respond securely",
  robots: { index: false, follow: false },
};

const idPattern = /^[A-Za-z0-9]{22}$/;

function GoneRequest() {
  return (
    <main className="kd-recipient-shell kd-request-public-shell">
      <section className="kd-request-gone">
        <h1>This request is no longer available</h1>
        <p>It may have expired, been cancelled, or already received a response.</p>
      </section>
    </main>
  );
}

export default async function PublicRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!idPattern.test(id)) notFound();

  const result = await requestBackend(`/requests/${encodeURIComponent(id)}/meta`);
  if (!result.ok) {
    if (result.status === 404 || result.status === 410) return <GoneRequest />;
    return (
      <main className="kd-recipient-shell kd-request-public-shell">
        <Alert tone="danger" title="Request unavailable">
          <p>{result.error}</p>
        </Alert>
      </main>
    );
  }

  const request = parsePublicSecretRequest(result.data);
  if (!request) {
    return (
      <main className="kd-recipient-shell kd-request-public-shell">
        <Alert tone="danger" title="Request unavailable">
          <p>Keydrop returned request details in an unexpected format. Refresh this page to try again.</p>
        </Alert>
      </main>
    );
  }
  if (request.status === "cancelled" || request.status === "expired") return <GoneRequest />;
  if (request.status === "fulfilled") {
    return (
      <main className="kd-recipient-shell kd-request-public-shell">
        <section className="kd-request-gone">
          <h1>This request has already been fulfilled</h1>
          <p>The response has been sent securely. No further response can be submitted.</p>
        </section>
      </main>
    );
  }

  return <RequestResponder request={request} />;
}
