import Link from "next/link";
import { Alert } from "@keydrop/ui";
import type { AdminApiHealth } from "../lib/admin-health";

export function AdminApiHealthPanel({
  health,
}: {
  health: AdminApiHealth;
}) {
  return (
    <section className="ad-panel ad-live-health" aria-labelledby="api-health-title">
      <div className="ad-panel-heading">
        <h2 id="api-health-title">Keydrop API</h2>
        <Link href="/system">System health</Link>
      </div>
      <div className="ad-panel-content">
        {health.state === "healthy" ? (
          <>
            <p>
              <strong>Reachable</strong>
            </p>
            <p className="ad-live-health-detail">
              Last checked{" "}
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(health.timestamp))}{" "}
              UTC.
            </p>
          </>
        ) : (
          <Alert tone="danger" title="Unavailable">{health.message}</Alert>
        )}
      </div>
    </section>
  );
}
