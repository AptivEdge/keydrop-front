"use client";

import { AppRail } from "@keydrop/ui";
import { customerNavigation } from "./customer-navigation";

export default function CustomerAppRail({
  currentPath,
  mobile = false,
}: {
  currentPath: string;
  mobile?: boolean;
}) {
  return <AppRail currentPath={currentPath} groups={customerNavigation} mobile={mobile} />;
}
