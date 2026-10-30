const internalOrigin = "https://keydrop.invalid";

export function getCustomerReturnTo(value: string | undefined): string | null {
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
  ) {
    return null;
  }

  try {
    const destination = new URL(value, internalOrigin);
    if (
      destination.origin !== internalOrigin
      || (
        destination.pathname !== "/pricing"
        && destination.pathname !== "/app"
        && !destination.pathname.startsWith("/app/")
      )
    ) {
      return null;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
}

export function getCustomerSessionRefreshPath(returnTo: string): string {
  const safeReturnTo = getCustomerReturnTo(returnTo) ?? "/app/secrets";
  return `/api/session/refresh?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
