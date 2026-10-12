# The Lakes Gardener app

Schedule, visits, invoices and customers for The Lakes Gardener.

- Screens: this folder, hosted on Netlify (`lakes-gardener-app`). Every push to `main` goes live.
- Data and logins: Supabase project `lakes-gardener` (London). Row-level security keeps each login's records private.
- Emails: `supabase/functions/send-document` sends invoice and receipt PDFs through Resend.

No customer data or secret keys belong in this repository.
