import type { AppRailGroup } from "@keydrop/ui";
import { FileKey2, LayoutDashboard, KeyRound } from "lucide-react";

export const customerNavigation: AppRailGroup[] = [{
  label: "Workspace",
  items: [
    { label: "Overview", href: "/app", icon: LayoutDashboard, exact: true },
    { label: "Secrets", href: "/app/secrets", icon: KeyRound },
    { label: "Requests", href: "/app/requests", icon: FileKey2 },
  ],
}];
