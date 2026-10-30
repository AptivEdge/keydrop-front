"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Flame,
  LockKeyhole,
  Mail,
  Menu,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "./cn";
import { BrandMark } from "./brand";
import {
  Alert,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Progress,
  Sheet,
  SheetContent,
  SheetTrigger,
  Skeleton,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./primitives";

export type StatusTone = "neutral" | "success" | "warning" | "danger";

const statusAppearance: Record<
  string,
  {
    label: string;
    tone: StatusTone;
    icon: React.ElementType;
    description: string;
  }
> = {
  active: {
    label: "Active",
    tone: "success",
    icon: CheckCircle2,
    description: "This item is active.",
  },
  awaiting_verification: {
    label: "Awaiting verification",
    tone: "neutral",
    icon: Mail,
    description: "Email verification is still required.",
  },
  partially_viewed: {
    label: "Partially viewed",
    tone: "neutral",
    icon: Eye,
    description: "This secret has remaining views.",
  },
  viewed: {
    label: "Viewed",
    tone: "neutral",
    icon: Eye,
    description: "This secret was viewed.",
  },
  expired: {
    label: "Expired",
    tone: "warning",
    icon: Clock3,
    description: "This item has expired.",
  },
  revoked: {
    label: "Revoked",
    tone: "danger",
    icon: Ban,
    description: "This item was revoked.",
  },
  locked: {
    label: "Locked",
    tone: "danger",
    icon: LockKeyhole,
    description: "This item is locked.",
  },
  pending: {
    label: "Pending",
    tone: "neutral",
    icon: Clock3,
    description: "This item is pending.",
  },
  fulfilled: {
    label: "Fulfilled",
    tone: "success",
    icon: CheckCircle2,
    description: "This request was fulfilled.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "danger",
    icon: Ban,
    description: "This item was cancelled.",
  },
  open: {
    label: "Open",
    tone: "warning",
    icon: AlertCircle,
    description: "This item is open.",
  },
  in_review: {
    label: "In review",
    tone: "neutral",
    icon: Activity,
    description: "This item is being reviewed.",
  },
  actioned: {
    label: "Actioned",
    tone: "success",
    icon: ShieldCheck,
    description: "This item was actioned.",
  },
  dismissed: {
    label: "Dismissed",
    tone: "neutral",
    icon: Ban,
    description: "This item was dismissed.",
  },
  escalated: {
    label: "Escalated",
    tone: "danger",
    icon: ShieldAlert,
    description: "This item was escalated.",
  },
  received: {
    label: "Received",
    tone: "neutral",
    icon: Mail,
    description: "This request was received.",
  },
  verifying_identity: {
    label: "Verifying identity",
    tone: "warning",
    icon: ShieldCheck,
    description: "Identity verification is in progress.",
  },
  completed: {
    label: "Completed",
    tone: "success",
    icon: CheckCircle2,
    description: "This item is complete.",
  },
  rejected: {
    label: "Rejected",
    tone: "danger",
    icon: Ban,
    description: "This item was rejected.",
  },
  approved: {
    label: "Approved",
    tone: "success",
    icon: CheckCircle2,
    description: "This item was approved.",
  },
  failed: {
    label: "Failed",
    tone: "danger",
    icon: AlertCircle,
    description: "This item failed.",
  },
  warning: {
    label: "Warning",
    tone: "warning",
    icon: AlertCircle,
    description: "This item needs attention.",
  },
  past_due: {
    label: "Past due",
    tone: "warning",
    icon: Clock3,
    description: "Payment is past due.",
  },
  running: {
    label: "Running",
    tone: "success",
    icon: Activity,
    description: "This process is running.",
  },
  queued: {
    label: "Queued",
    tone: "neutral",
    icon: Clock3,
    description: "This process is queued.",
  },
  succeeded: {
    label: "Succeeded",
    tone: "success",
    icon: CheckCircle2,
    description: "This process succeeded.",
  },
  dead: {
    label: "Dead letter",
    tone: "danger",
    icon: Flame,
    description: "This process stopped permanently.",
  },
  off: {
    label: "Off",
    tone: "neutral",
    icon: Activity,
    description: "This switch is off.",
  },
  on: {
    label: "On",
    tone: "warning",
    icon: Activity,
    description: "This switch is on.",
  },
  suspended: {
    label: "Suspended",
    tone: "danger",
    icon: Ban,
    description: "This account is suspended.",
  },
  deletion_pending: {
    label: "Deletion pending",
    tone: "warning",
    icon: Clock3,
    description: "This account is scheduled for deletion.",
  },
  invited: {
    label: "Invited",
    tone: "neutral",
    icon: Mail,
    description: "This admin has been invited.",
  },
  offboarded: {
    label: "Offboarded",
    tone: "danger",
    icon: Ban,
    description: "This admin account is offboarded.",
  },
  verifying: {
    label: "Verifying",
    tone: "warning",
    icon: ShieldCheck,
    description: "Verification is in progress.",
  },
  in_progress: {
    label: "In progress",
    tone: "neutral",
    icon: Activity,
    description: "This request is in progress.",
  },
  expired_approval: {
    label: "Expired",
    tone: "warning",
    icon: Clock3,
    description: "This approval has expired.",
  },
  dead_letter: {
    label: "Dead letter",
    tone: "danger",
    icon: Flame,
    description: "This process stopped permanently.",
  },
  removed: {
    label: "Removed",
    tone: "neutral",
    icon: Ban,
    description: "This entry was removed.",
  },
  halted: {
    label: "Halted",
    tone: "danger",
    icon: Ban,
    description: "This subscription is halted.",
  },
  paused: {
    label: "Paused",
    tone: "warning",
    icon: Clock3,
    description: "This subscription is paused.",
  },
  authenticated: {
    label: "Authenticated",
    tone: "success",
    icon: CheckCircle2,
    description: "This payment is authenticated.",
  },
  created: {
    label: "Created",
    tone: "neutral",
    icon: CheckCircle2,
    description: "This item was created.",
  },
  deletion_requested: {
    label: "Deletion requested",
    tone: "warning",
    icon: Clock3,
    description: "Deletion has been requested.",
  },
};

export function StatusBadge({
  status,
  label,
  detail,
  className,
}: {
  status: string;
  label?: string;
  detail?: string;
  className?: string;
}) {
  const appearance = statusAppearance[status.toLowerCase()] ?? {
    label: status.replaceAll("_", " "),
    tone: "neutral" as const,
    icon: Activity,
    description: `Status: ${status.replaceAll("_", " ")}.`,
  };
  const Icon = appearance.icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            className={cn("kd-status-badge", className)}
            tone={appearance.tone}
          />
        }
      >
        <Icon aria-hidden="true" />
        <span>{label ?? appearance.label}</span>
        {detail && <span className="kd-status-detail">{detail}</span>}
      </TooltipTrigger>
      <TooltipContent>{appearance.description}</TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Activity,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("kd-empty-state", className)}>
      <span className="kd-empty-icon">
        <Icon aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <Alert tone="danger" title={title}>
      <p>{description}</p>
      {onRetry && (
        <Button className="kd-inline-retry" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Alert>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("kd-page-header", className)}>
      <div>
        {breadcrumbs}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="kd-page-header-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  description,
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  description?: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <span className="kd-stat-label">{label}</span>
      <span className="kd-stat-value">{value}</span>
      {description && (
        <span className="kd-stat-description">{description}</span>
      )}
    </>
  );
  return href ? (
    <a
      href={href}
      className={cn("kd-stat-card", "kd-stat-card--link", className)}
    >
      {content}
    </a>
  ) : (
    <div className={cn("kd-stat-card", className)}>{content}</div>
  );
}

export function StatGrid({
  children,
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("kd-stat-grid", className)}>{children}</div>;
}

export function RangeTabs({
  value,
  onValueChange,
  options,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <TabsList aria-label="Date range">
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export interface ActivityPoint {
  label: string;
  value: number;
}

export function ActivityChart({
  data,
  loading = false,
  error,
  onRetry,
  label = "Activity",
}: {
  data: ActivityPoint[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  label?: string;
}) {
  if (loading) return <Skeleton className="kd-chart-skeleton" />;
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  if (!data.length)
    return (
      <EmptyState
        title="No activity yet"
        description="Activity will appear here when it is available."
      />
    );

  return (
    <Card className="kd-chart-card">
      <div
        role="img"
        aria-label={`${label} chart with ${data.length} data points`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={data}
            margin={{ top: 12, right: 12, bottom: 0, left: -20 }}
          >
            <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "var(--text-muted)",
                fontSize: 11,
                fontFamily: "var(--font-geistmono)",
              }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "var(--text-muted)",
                fontSize: 11,
                fontFamily: "var(--font-geistmono)",
              }}
            />
            <RechartsTooltip
              contentStyle={{
                background: "var(--surface-card)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-lg)",
                color: "var(--text-primary)",
              }}
              labelStyle={{ color: "var(--text-secondary)" }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--action-primary)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--action-primary)",
                stroke: "var(--surface-card)",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="kd-visually-hidden">
        <caption>{label} data</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function UpgradeCard({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("kd-upgrade-card", className)}>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </Card>
  );
}

export function LinkField({
  value,
  label = "Secret link",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState("");

  async function copyValue() {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      inputRef.current?.select();
      setCopyError("Press Ctrl or Cmd + C to copy.");
    }
  }

  return (
    <div className={cn("kd-link-field", className)}>
      <label className="kd-visually-hidden" htmlFor={inputId}>
        {label}
      </label>
      <Input
        ref={inputRef}
        id={inputId}
        className="kd-mono"
        value={value}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      <Button
        variant="outline"
        onClick={copyValue}
        aria-label={copied ? "Link copied" : "Copy link"}
      >
        <Copy aria-hidden="true" />
        {copied ? "Copied" : "Copy"}
      </Button>
      {copyError && (
        <span role="status" className="kd-field-feedback">
          {copyError}
        </span>
      )}
    </div>
  );
}

export function SecretBox({
  secret,
  onCopy,
  onClear,
  clearAfterSeconds = 60,
  className,
}: {
  secret: string;
  onCopy?: () => void;
  onClear?: () => void;
  clearAfterSeconds?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLPreElement>(null);
  const onClearRef = React.useRef(onClear);
  const [visible, setVisible] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState("");
  const [remainingSeconds, setRemainingSeconds] =
    React.useState(clearAfterSeconds);
  const [cleared, setCleared] = React.useState(false);

  React.useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  React.useEffect(() => {
    if (clearAfterSeconds <= 0) return;
    const deadline = Date.now() + clearAfterSeconds * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        setCleared(true);
        setVisible(false);
        onClearRef.current?.();
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [clearAfterSeconds]);

  async function copySecret() {
    if (cleared || !visible) return;
    if (onCopy) {
      onCopy();
      return;
    }
    setCopyError("");
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(
        "Clipboard access failed. Select the secret and copy it manually.",
      );
    }
  }
  return (
    <div className={cn("kd-secret-box", className)}>
      {cleared ? (
        <p className="kd-secret-cleared" role="status">
          Cleared from this screen.
        </p>
      ) : (
        <>
          <pre
            ref={ref}
            tabIndex={0}
            aria-label="Your secret"
            onFocus={(event) => {
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(event.currentTarget);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }}
          >
            {visible ? secret : "••••••••••••••••"}
          </pre>
          <div className="kd-secret-actions">
            <Button
              variant="outline"
              size="small"
              onClick={() => setVisible((current) => !current)}
            >
              {visible ? (
                <EyeOff aria-hidden="true" />
              ) : (
                <Eye aria-hidden="true" />
              )}
              {visible ? "Hide" : "Show"}
            </Button>
            <Button variant="outline" size="small" onClick={copySecret}>
              <Copy aria-hidden="true" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          {clearAfterSeconds > 0 && (
            <div
              className="kd-secret-countdown"
              role="timer"
              aria-label={`Clears in ${remainingSeconds} seconds`}
            >
              <Progress value={(remainingSeconds / clearAfterSeconds) * 100} />
              <span>Clears from this screen in {remainingSeconds}s</span>
            </div>
          )}
          {copyError && (
            <span role="status" className="kd-field-feedback">
              {copyError}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function SecretRow({
  id,
  status,
  createdAt,
  expiresAt,
  actions,
  className,
}: {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("kd-secret-row", className)}>
      <span className="kd-mono">{id}</span>
      <StatusBadge status={status} />
      <time>{createdAt}</time>
      <span>{expiresAt}</span>
      {actions ?? (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for secret ${id}`}
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

export function Timeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) {
  return (
    <ol className={cn("kd-timeline", className)}>
      {events.map((event) => (
        <li key={event.id} data-tone={event.tone ?? "neutral"}>
          <span className="kd-timeline-marker" aria-hidden="true" />
          <div>
            <p>{event.title}</p>
            {event.description && (
              <p className="kd-muted">{event.description}</p>
            )}
            <time className="kd-mono">{event.timestamp}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MaskedValue({
  value,
  label,
  onReveal,
  className,
}: {
  value: string;
  label: string;
  onReveal: (reason: string) => Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [revealed, setRevealed] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(""), 60_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  async function submitReveal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 10) {
      setError("Enter a reason of at least 10 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onReveal(reason.trim());
      setRevealed(value);
      setReason("");
      setOpen(false);
    } catch {
      setError("Could not reveal this value. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("kd-masked-value", className)}>
      {revealed || "••••••••"}
      {!revealed && (
        <>
          <Button variant="ghost" size="small" onClick={() => setOpen(true)}>
            Reveal {label}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Reveal {label}</DialogTitle>
              <DialogDescription>
                This access is recorded in the admin audit log.
              </DialogDescription>
              <form className="kd-reveal-form" onSubmit={submitReveal}>
                <label htmlFor="kd-reveal-reason">Reason</label>
                <Input
                  id="kd-reveal-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={10}
                  required
                  autoFocus
                />
                {error && (
                  <p role="alert" className="kd-field-feedback">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  loading={busy}
                  disabled={reason.trim().length < 10}
                >
                  Reveal for 60 seconds
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </span>
  );
}

export interface AppRailItem {
  label: string;
  href: string;
  icon: React.ElementType;
  locked?: boolean;
  exact?: boolean;
}

export interface AppRailGroup {
  label?: string;
  items: AppRailItem[];
}

export function AppRail({
  groups,
  currentPath,
  brand = "Keydrop",
  mobile = false,
  className,
}: {
  groups: AppRailGroup[];
  currentPath: string;
  brand?: string;
  mobile?: boolean;
  className?: string;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navigation = (
    <SidebarProvider defaultOpen className="kd-sidebar-provider">
      <Sidebar
        collapsible="none"
        className={cn("kd-app-rail", className)}
        style={
          mobile
            ? {
                borderRight: "unset",
              }
            : {}
        }
      >
        <SidebarHeader>
          <Link
            href="/"
            className="kd-rail-brand"
            aria-label={`${brand} home`}
            onClick={() => mobile && setMobileOpen(false)}
          >
            <BrandMark />
            <span>{brand}</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          {groups.map((group, groupIndex) => (
            <SidebarGroup key={`${group.label ?? "group"}-${groupIndex}`}>
              {group.label && (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      currentPath === item.href ||
                      (!item.exact && currentPath.startsWith(`${item.href}/`));
                    const link = (
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-disabled={item.locked || undefined}
                        onClick={(event) => {
                          if (item.locked) {
                            event.preventDefault();
                          } else if (mobile) {
                            setMobileOpen(false);
                          }
                        }}
                      />
                    );
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={link}
                          isActive={active}
                          tooltip={item.label}
                        >
                          <Icon aria-hidden="true" />
                          <span>{item.label}</span>
                          {item.locked && (
                            <LockKeyhole aria-label="Plan locked" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        {!mobile && <SidebarFooter />}
      </Sidebar>
    </SidebarProvider>
  );
  if (!mobile) return navigation;
  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="kd-mobile-rail-trigger"
            aria-label="Open navigation"
          />
        }
      >
        <Menu aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="left" className="kd-mobile-rail">
        <DialogTitle className="kd-visually-hidden">
          Application navigation
        </DialogTitle>
        {navigation}
      </SheetContent>
    </Sheet>
  );
}

export function EnvironmentBanner({
  environment,
}: {
  environment: "production" | "staging";
}) {
  return (
    <div
      className={`kd-environment kd-environment--${environment}`}
      role="status"
    >
      <ShieldAlert aria-hidden="true" />
      <span>{environment} environment</span>
      <span className="kd-environment-detail">Admin actions are audited</span>
    </div>
  );
}

export function AppShell({
  rail,
  header,
  children,
  environment,
  className,
}: {
  rail: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
  environment?: "production" | "staging";
  className?: string;
}) {
  return (
    <div className={cn("kd-app-shell", className)}>
      {environment && <EnvironmentBanner environment={environment} />}
      <div className="kd-app-layout">
        <aside className="kd-app-sidebar">{rail}</aside>
        <div className="kd-app-main">
          <header className="kd-app-toolbar">{header}</header>
          <main className="kd-app-content">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function UserAvatar({
  src,
  name,
  className,
}: {
  src?: string;
  name: string;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <Avatar className={cn("kd-avatar", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback>{initials || "KD"}</AvatarFallback>
    </Avatar>
  );
}

export function FormProgress({
  value,
  label,
}: {
  value: number;
  label?: string;
}) {
  return (
    <div className="kd-form-progress">
      <Progress value={value} aria-label={label ?? "Progress"} />
      <span className="kd-mono">{Math.round(value)}%</span>
    </div>
  );
}
