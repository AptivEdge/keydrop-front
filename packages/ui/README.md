# `@keydrop/ui`

Shared React components and visual tokens for the Keydrop web frontend and its separate admin deployable.

## Setup

Install the package through the workspace, and import its styles once from each app's global stylesheet:

```css
@import "tailwindcss";
@import "@keydrop/ui/tokens.css";
@import "@keydrop/ui/components.css";
```

Components are framework-neutral React. Use the consuming app's router links around them where navigation integration is needed.

```tsx
import { Button, Card, CardContent, PageHeader, StatusBadge } from "@keydrop/ui";

export function Example() {
  return (
    <>
      <PageHeader title="Secrets" description="Manage your active links." />
      <Card><CardContent><StatusBadge status="active" /></CardContent></Card>
      <Button>Create secret</Button>
    </>
  );
}
```

## Exports

### Primitives

`Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Tabs`, `Card` composition, `Badge`, `Alert`, `Dialog`, `SheetContent`, `DropdownMenu`, `Popover`, `Table`, `Tooltip`, `Progress`, `Skeleton`, `Avatar`, `Separator`, `Breadcrumb`, `Accordion`, `Toaster`, and `toast`.

### Keydrop patterns

`StatusBadge`, `SecretRow`, `SecretBox`, `LinkField`, `Timeline`, `StatCard`, `StatGrid`, `ActivityChart`, `RangeTabs`, `UpgradeCard`, `AppRail`, `PageHeader`, `EnvironmentBanner`, `MaskedValue`, `UserAvatar`, `FormProgress`, `EmptyState`, and `ErrorState`.

### Marketing composition

`Wordmark`, `BrandMark`, `MarketingHeader`, `MarketingFooter`, `HeroAtmosphere`, `SectionHeading`, and `NeutralAction`.

All controls use Radix UI for keyboard behavior where applicable, native form semantics for fields, Lucide for icons, and the shared CSS tokens. Product-specific components preserve frontend/admin specification rules; they do not implement authentication, crypto, network calls, or admin authorization.

## Ownership and boundaries

- `styles/tokens.css` is the only source of raw design tokens; `styles/components.css` owns package styling and self-hosted Inter/Geist Mono font loading.
- The frontend and admin apps import the same package styles, but keep their own app layouts, routing, and backend integration.
- The admin app is a separate deployable and is not present in this repository.
- Never render secret material in admin components. `SecretBox` is only for a recipient view after explicit reveal.
- A `MaskedValue` reveal callback must perform its own authorized, audited server request; the component only gathers a reason and displays the already-authorized value temporarily.
