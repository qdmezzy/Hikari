# Hikari auth email templates

These are plain, mobile-friendly Supabase Auth templates using Hikari's dark surfaces, warm gold accent, editorial spacing, and short direct copy. They use only inline styles so the layout survives common email clients.

| Supabase template | Subject | File |
| --- | --- | --- |
| Confirm signup | Confirm your Hikari email | `confirm-signup.html` |
| Reset password | Reset your Hikari password | `reset-password.html` |

Both templates use Supabase's `{{ .TokenHash }}` variable and Hikari's existing `/auth/confirm` handler, preserving the working signup and password recovery flows. In the hosted Supabase project, open **Authentication → Email Templates**, choose the matching template, set its subject, paste the corresponding HTML, save, and send a test email before publishing it to users.

Both templates were saved in production Supabase on November 13, 2026, with the Hikari wordmark. The redesigned reset email arrived in Gmail's Inbox and its logo loaded. Its original-message diagnostics, checked November 18, report SPF, DKIM, and DMARC PASS. A complete new-account signup and a password change are not covered by that delivery check.
