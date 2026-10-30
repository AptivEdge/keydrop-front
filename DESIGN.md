# Keydrop Design System

## Visual Direction

Keydrop uses the shadcn/ui Nova preset with a neutral palette, clear page hierarchy, quiet surfaces, compact labels, and approachable controls. Keep Keydrop's product behavior, security guarantees, copy, roles, statuses, and data model unchanged.

The marketing site, customer workspace, and staff admin share the same visual language. Marketing pages can use restrained brand atmosphere; workspace, admin, and recipient screens prioritize information clarity and avoid decorative gradients.

## Color and Surfaces

The canonical tokens live in `packages/ui/styles/tokens.css`.

- Canvas and recessed surfaces use cool, light neutrals; cards and panels use white.
- Primary text is deep charcoal; secondary and muted text use progressively softer neutral grays.
- Primary actions and active states use the preset's neutral foreground/background tokens.
- Use neutral accent tints for selected controls and active navigation, not as a substitute for semantic status colors.
- Success, warning, danger, and info use distinct semantic colors with accompanying text and icons; status meaning is never color-only.
- Use restrained borders and soft shadows for depth. Do not introduce a dark theme or alternate dark sections.

## Typography

- Geist is the interface face; use DM Sans for headings. Use clear hierarchy and reserve medium or semibold weight for headings, navigation, controls, and compact metadata.
- Geist Mono is for IDs, code, secret values, timestamps, and technical metadata—not decorative body text.
- UI icons use Lucide SVGs.
- Keep the self-hosted Fontsource fonts; avoid external runtime font requests.

## Geometry and Depth

- Use the shared spacing scale and consistent alignment across marketing and workspace pages.
- Marketing content is centered and spacious; app screens use denser page spacing, a persistent sidebar, and a clear top toolbar.
- Inputs, buttons, cards, and badges use the shared radius tokens.
- Use fine neutral borders and soft, low-elevation shadows. Avoid heavy outlines, hard shadows, and nested-card framing.
- Use responsive navigation and data layouts without horizontal overflow at mobile widths.

## Interaction and Accessibility

- Primary actions are purple-filled controls with white text. Secondary controls are neutral outline or text actions.
- Inputs use light neutral surfaces. Focus is visible with a high-contrast brand ring, keyboard-operable, and independent of color alone.
- Interactive targets are at least 44 px unless a dense table control is explicitly permitted by its specification.
- Support loading, empty, error, disabled, success, permission-denied, and reduced-motion states where relevant.
- Keep the product security contract: do not send or persist plaintext secrets in preview flows, and never expose secret content in admin UI.
- Product status text, icons, and colors follow the source-of-truth status model; all three are present where status is shown.

## Shared UI Package

`@keydrop/ui` is the canonical shared component and token package for the web frontend and its separate admin deployable. Both apps import `@keydrop/ui/tokens.css` and `@keydrop/ui/components.css` and consume the package's accessible shared components and product patterns.

The shared component layer uses shadcn/ui components built on Base UI, with product-specific patterns composed from those components. Do not replace or remove functional controls unless an equivalent accessible implementation preserves keyboard behavior and product semantics.

The customer web and staff admin remain separate Next.js deployables in `apps/web` and `apps/admin`; both consume the shared UI package. Apply the same tokens and component language to both.
