export function downloadRequestRecoveryFile(requestId: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `keydrop-request-${requestId}-recovery.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
