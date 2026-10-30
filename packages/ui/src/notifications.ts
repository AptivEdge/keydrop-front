export enum NotificationMessage {
  ApiUnavailable = "We're having trouble connecting right now. Please try again in a moment.",
  ApiTimeout = "This is taking longer than expected. Please try again in a moment.",
  ApiTemporarilyUnavailable = "We hit a temporary snag. Please try again in a moment.",
  InvalidResponse = "We couldn't load this just now. Please try again in a moment.",
  ServiceNotConfigured = "This service isn't available right now. Please try again later.",
  TooManyAttempts = "Please wait a moment before trying again.",
  SignInRequired = "Please sign in again to continue.",
  RefreshPage = "Your sign-in needs a quick refresh. Please reload this page and try again.",
  SignInDetailsRejected = "We couldn't sign you in with those details. Please check your email and password and try again.",
  AccessDenied = "You don't have access to this area. If you think you should, please contact support.",
  NotFound = "We couldn't find what you're looking for. Please check the link and try again.",
  CheckDetails = "Please check the information you entered and try again.",
  AlreadyUpdated = "This may have changed since you opened it. Please refresh and check its current status.",
  RequestFailed = "We couldn't complete that just now. Please try again in a moment.",
}

export function getApiNotificationMessage(
  status: number,
  code?: string,
  path?: string,
): NotificationMessage {
  if (code === "rate_limited" || status === 429) {
    return NotificationMessage.TooManyAttempts;
  }
  if (code === "validation_failed" || status === 400 || status === 422) {
    return NotificationMessage.CheckDetails;
  }
  if (status === 401) {
    return path?.endsWith("/login")
      ? NotificationMessage.SignInDetailsRejected
      : NotificationMessage.SignInRequired;
  }
  if (status === 403) return NotificationMessage.AccessDenied;
  if (status === 404) return NotificationMessage.NotFound;
  if (status === 409) return NotificationMessage.AlreadyUpdated;
  if (status === 408 || status === 504) return NotificationMessage.ApiTimeout;
  if (status >= 500) return NotificationMessage.ApiTemporarilyUnavailable;
  return NotificationMessage.RequestFailed;
}
