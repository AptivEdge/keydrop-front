"use client";

import { Skeleton } from "@keydrop/ui";

export default function CustomerWorkspaceLoading() {
  return (
    <main
      className="kd-secrets-content kd-workspace-transition"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <div className="kd-workspace-transition-heading">
        <div>
          <Skeleton />
          <Skeleton />
        </div>
        <Skeleton />
      </div>
      <div className="kd-workspace-transition-stats">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}
      </div>
      <div className="kd-workspace-transition-content">
        <Skeleton />
        <Skeleton />
      </div>
    </main>
  );
}
