import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@keydrop/ui";
import { MarketingSiteFooter, MarketingSiteHeader } from "./site-navigation";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="kd-legal-layout">
      <MarketingSiteHeader />
      <main className="kd-page-shell kd-legal-main">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <header className="kd-legal-heading">
          <h1>{title}</h1>
          <p>Last updated October 25, 2026</p>
        </header>
        <div className="kd-legal-content">{children}</div>
      </main>
      <MarketingSiteFooter />
    </div>
  );
}
