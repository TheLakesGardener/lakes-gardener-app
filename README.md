# The Lakes Gardener app

Schedule, visits, invoices and customers for The Lakes Gardener.

- Screens: this folder, hosted on Netlify (`lakes-gardener-app`). Every push to `main` goes live.
- Data and logins: Supabase project `lakes-gardener` (London). Row-level security keeps each login's records private.
- Emails: `supabase/functions/send-document` sends invoice and receipt PDFs through Resend.

No customer data or secret keys belong in this repository.

## Hosting status (15 Oct 2026)

- Live app: https://thelakesgardener.github.io/lakes-gardener-app/ (GitHub Pages, serves the `gh-pages` branch).
- The old Netlify site (lakes-gardener-app in Collette's Tooth Fairy 2 U team) is still linked to `main` and is frozen at commit 4a4ed64. Netlify free credits are used up, so **push app updates to `gh-pages` only** until that Netlify site is deleted, so it never uses Collette's credits.
- Still to do:
  1. Supabase → Authentication → URL Configuration: set Site URL to the GitHub Pages address and add it under Redirect URLs, so email login links open the new address.
  2. Netlify (Collette's login): delete the lakes-gardener-app site. Leave tf2u-practice alone.
  3. Save the new address to the phone's home screen and log in once.
