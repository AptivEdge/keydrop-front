export const verificationResendCooldownSeconds = 60;

export function getResendCooldownSeconds(status: number | undefined): number {
  return status === 429 ? verificationResendCooldownSeconds : 0;
}
