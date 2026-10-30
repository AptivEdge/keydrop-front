import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keydrop/ui";
import { getAdminDeliverability } from "../../lib/admin-deliverability";

function formatTime(value: string | null): string {
  if (!value) return "No retry scheduled";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value)) + " UTC";
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="ad-deliverability-metric">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export async function AdminDeliverabilityPage({ idToken }: { idToken: string }) {
  const result = await getAdminDeliverability(idToken);

  return (
    <section className="ad-page">
      <PageHeader
        title="Notifications health"
        description="Email provider configuration and live notification retry queue status."
      />
      {result.state === "unavailable" ? (
        <Alert tone="danger" title="Email deliverability data unavailable">
          {result.message}
        </Alert>
      ) : (
        <>
          <div className="ad-deliverability-grid">
            <Card>
              <CardHeader>
                <CardTitle>Email provider</CardTitle>
                <CardDescription>
                  Checked {formatTime(result.data.checkedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="ad-deliverability-details">
                <p>
                  Configuration:{" "}
                  <Badge>{result.data.configuration.state}</Badge>
                </p>
                <p>Provider: {result.data.configuration.provider}</p>
                <p>
                  API key: {result.data.configuration.apiKeyConfigured ? "Configured" : "Missing"}
                </p>
                <p>
                  Sender: {result.data.configuration.senderConfigured ? "Configured" : "Missing"}
                </p>
                <p>
                  Templates: {result.data.configuration.configuredTemplates} of{" "}
                  {result.data.configuration.totalTemplates} configured
                </p>
                {!result.data.configuration.providerSupported && (
                  <p role="status">This provider is not supported by the current email sender.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notification queue</CardTitle>
                <CardDescription>
                  Live counts from the persisted email notification outbox.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="ad-deliverability-metrics">
                  <MetricCard label="Pending" value={result.data.queue.pending} />
                  <MetricCard label="Due now" value={result.data.queue.due} />
                  <MetricCard label="Retrying" value={result.data.queue.retrying} />
                  <MetricCard label="Retry limit reached" value={result.data.queue.exhausted} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert tone="info" title="Provider delivery receipts are not recorded">
            {result.data.message}
          </Alert>

          <Card className="ad-deliverability-history">
            <CardHeader>
              <CardTitle>Recent email retries</CardTitle>
              <CardDescription>
                Notification event metadata only. Recipient addresses and email payloads are not shown.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="ad-table-scroll">
                <Table className="ad-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Notification</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Next retry</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.data.recentRetries.length > 0 ? (
                      result.data.recentRetries.map((retry) => (
                        <TableRow key={retry.id}>
                          <TableCell><span className="kd-mono">{retry.id}</span></TableCell>
                          <TableCell>{retry.type.replaceAll("_", " ")}</TableCell>
                          <TableCell>{retry.attempts}</TableCell>
                          <TableCell>
                            <Badge>{retry.state === "exhausted" ? "Retry limit reached" : "Retry scheduled"}</Badge>
                          </TableCell>
                          <TableCell>{formatTime(retry.nextAttemptAt)}</TableCell>
                          <TableCell>{formatTime(retry.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6}>
                          No notification email retries are currently recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
