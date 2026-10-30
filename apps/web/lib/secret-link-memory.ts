const secretLinks = new Map<string, string>();
const listeners = new Set<() => void>();

export function rememberSecretLink(id: string, link: string) {
  secretLinks.clear();
  secretLinks.set(id, link);
  listeners.forEach((listener) => listener());
}

export function getRememberedSecretLink(id: string): string | null {
  return secretLinks.get(id) ?? null;
}

export function subscribeToSecretLinks(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getEmptySecretLinkSnapshot() {
  return null;
}
