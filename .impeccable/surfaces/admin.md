# Admin console surface

- **Mode:** Operate
- **Audience:** Keydrop staff performing support, trust and safety, billing, and platform operations.
- **Primary task:** Review synthetic account and system metadata, then locate the appropriate workflow without exposing secret content.
- **Visual authority:** `DESIGN.md`, adapted for a denser staff console. Preserve neutral surfaces, shared tokens, explicit statuses, and the prominent environment banner.
- **Composition:** Grouped rail navigation, global search, environment/session context, operational overview, dense metadata tables, and record details.
- **Security boundary:** This workspace is a UI preview only. Use synthetic data, mask sensitive fields, never render secret content, and keep mutations disabled until server-side auth, role checks, audit logging, and the restricted admin API exist.
- **Responsive behavior:** Expanded rail on desktop, icon rail below 1024 px, menu sheet below 640 px; overview and approvals remain readable on mobile.
