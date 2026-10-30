"use client";

import { Toaster as ShadcnToaster } from "./components/ui/sonner";
import type { ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return <ShadcnToaster position="bottom-right" {...props} />;
}

export { toast } from "sonner";
