// InputCookieCapture — REMOVED
//
// This component previously wrote user_email, user_phone, and user_name to
// document.cookie via an input event listener. That behaviour has been
// replaced: lead data now goes exclusively to the Make webhook POST in
// BookingFlow.tsx (handleQualificationComplete → postToMakeWebhook).
//
// The export is kept as a no-op so any residual import doesn't break the
// build while layout.tsx is updated in the same commit.

export function InputCookieCapture() {
    return null;
}
