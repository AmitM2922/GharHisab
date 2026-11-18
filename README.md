# GharHisab

**Har Eent, Har Rupaye Ka Hisab.** A mobile-first construction expense, material and contribution ledger. React + Vite + TypeScript, Tailwind, Motion, Recharts, React Hook Form, Zod, TanStack Query, Supabase/PostgreSQL. Static hosting on GitHub Pages; no application server or paid API.

## Current status

The application includes live Supabase services, transactional SQL functions, restricted public projections, admin authentication, private receipts, reports and a GitHub Pages workflow. It is **not connected to a hosted Supabase project or deployed yet**. Create your free project and complete the steps below. The local workspace currently uses explicitly labeled demo mode; demo mutations reset on page reload.

## 1. Run locally

Install Node.js **22 LTS** and restart your terminal/IDE. From this folder:

```sh
npm ci
npm run dev
```

In this workspace only, ` .\start-dev.cmd` also uses the temporary runtime in `.tools`. That directory is excluded from source control and is not part of the delivered application.

For demo mode, create `.env.local` containing `VITE_DEMO_MODE=true`. For live mode, follow step 4. Vite prints the actual local URL; if 5173 is busy, it chooses another port. Keep the terminal running.

To preview on your actual phone, connect the phone and computer to the same Wi-Fi and run `npm run dev -- --host 0.0.0.0`. Open the **Network** URL Vite prints on the phone. Windows Firewall may need permission for that local network. This is a local development preview; use the HTTPS GitHub Pages URL for everyday access.

## 2. Create the free Supabase project

1. Create a project at [Supabase](https://supabase.com/dashboard), selecting the Free plan and an appropriate region. Keep the database password private.
2. In **SQL Editor**, run the migration files once each in filename order: `202611170001_core.sql`, `202611180001_material_lines.sql`, then `202611180002_whole_rupee_rounding.sql`. These create the ledger, material lines, stock checks, audit history, RPC functions, RLS, private receipts and saved whole-rupee pricing. For an existing project, run only migrations not already applied. The rounding migration contains a narrowly guarded correction for the reported ₹9,790.01 steel invoice; it changes that one invoice only if the saved ID, quantity, rate and ₹9,790 payment total still match. It does not rewrite payment records or change unrelated invoices.
3. In **Authentication → configuration**, turn **Allow new users to sign up** OFF. Disable anonymous sign-ins and any unused providers. This dashboard setting is required for hosted Supabase; the local `supabase/config.toml` does not configure an existing hosted project.
4. Use **Authentication → Users → Add user** to create your admin account with an email and strong password. Mark the email confirmed if the dashboard offers that option. Do not create accounts through the public website.
5. Copy the user's UUID. Replace the placeholder in `supabase/bootstrap-admin.sql` and execute it in SQL Editor. Only one admin identity can exist, and ordinary clients cannot insert or change it.
6. Set your Supabase Auth site URL to `https://AmitM2922.github.io/GharHisab/`. For password recovery, use the Supabase dashboard's supported admin process; there is no public signup or password-reset flow in this app.

Do **not** run `supabase/seed.sql` on your real construction ledger. It is optional fictional demo data for a separate test project, requires an empty ledger and visibly renames the project `DEMO — Our dream home`. No sample financial records are installed by the migration.

## 3. Obtain public client settings

In Supabase project settings, find the project URL and **publishable key** (or legacy **anon** key). These are browser-safe identifiers when the supplied database permissions are installed. Never use a secret/service-role key, database password or admin password in a Vite variable, GitHub repository, chat or source file.

## 4. Connect live mode

Copy `.env.example` to `.env.local` and fill in:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_DEMO_MODE=false
VITE_BASE_PATH=/
```

Restart Vite after editing environment variables. Without live configuration, the app shows setup guidance; it does not silently display sample records. With a fresh project, it shows empty financial records. Use the avatar or sidebar **Admin login**, sign in and edit your project details, then add your first expense.

## 5. Deploy to your GitHub repository

Repository: [AmitM2922/GharHisab](https://github.com/AmitM2922/GharHisab).

1. Keep the repository **public** to use GitHub Pages on GitHub Free.
2. Push these source files to its `main` branch. If Git is installed and this folder is not yet a repository:

```sh
git init
git add .
git commit -m "Build mobile-first GharHisab application"
git branch -M main
git remote add origin https://github.com/AmitM2922/GharHisab.git
git push -u origin main
```

If the remote already contains files, clone it first and copy this source into the clone, preserving remote files. Do not force-push or overwrite existing work. `.gitignore` excludes `.env.local`, `.tools`, dependencies, generated builds and test artifacts. Commit `.env.example` and `package-lock.json`.

3. In repository **Settings → Secrets and variables → Actions → Variables**, create:
   - `VITE_SUPABASE_URL`: your project URL.
   - `VITE_SUPABASE_ANON_KEY`: your publishable/anon key.
4. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
5. Open **Actions → Check and deploy GharHisab**. Run it, or push to main. The workflow installs dependencies, tests the database rules, builds live mode, checks mobile/demo workflows and deploys the static `dist` output. It refuses deployment if either live variable is absent. Pull requests run checks without publishing.
6. Expected URL after successful deployment: **https://AmitM2922.github.io/GharHisab/**. This is the configured target, not a claim that it is already live. The workflow sets `/GharHisab/` automatically, preserving repository-name casing. HashRouter supports direct links such as `.../GharHisab/#/expenses`.

Vite's base path is configurable via `VITE_BASE_PATH`; the build remains entirely static. Your admin login is sent directly to Supabase over HTTPS; GitHub Pages serves only assets. Later design changes can be committed and redeployed without resetting the database. Schema changes need a new migration; never rerun destructive setup on live data.

## Everyday use

- **Overview:** total incurred expenses, material expenses, contractor costs, other expenses and pending dues. No total/remaining budget cards. On phones, financial totals appear before the decorative welcome panel.
- **Expenses:** search, category/payment filters, dates, sorting, pagination, CSV and printing. Touch a transaction card to open its details.
- **New expense:** select multiple materials from the searchable checkbox list, or use **Other / enter manually** for custom material names. Every selected material has its own quantity, unit, rate and line total. The invoice total is the sum of line totals; one invoice, payment history and receipt remain together. Non-material invoices accept an agreed amount. Optional contractor work type, period, workers/days/rate describe the work. Choose whether the invoice is publicly visible. Description is public; notes are private. On mobile, transaction cards show the vendor name below the category.
- **Whole-rupee pricing:** new material lines default to nearest-rupee rounding (half-up). For example, 1.5 × ₹6,526.67 saves ₹9,790 rather than creating a one-paisa balance. The per-line checkbox can retain exact paise pricing when required. Existing lines retain their stored pricing unless explicitly changed or covered by the narrowly guarded screenshot repair. If rounding would lower an invoice below actual payments already recorded, saving is rejected. Transaction progress never says 100% paid while a real balance remains. Payment and contribution records keep their actual values rather than being silently rounded.
- **Payments:** the first paid amount becomes an individual payment entry. Use the transaction's Payment history to add/correct/delete later payments. The paid-so-far field in invoice editing is read-only to preserve payment history. Bank/UPI references and payment notes are private.
- **Receipts:** choose or drag a JPG, PNG or WebP image up to 5 MB, including UPI/bank screenshots. Save the expense to persist it. Images use a private bucket and short-lived signed access for the admin. Viewers receive no receipt paths, URLs or notes. There is no public receipt-sharing feature by default.
- **Materials:** purchases, consumed stock, availability, weighted average price and supplier/purchase history. Admin can add/edit materials and record/correct/delete usage. Stock may not go negative. Correct a mistaken usage entry before reducing a purchase; there is no bypass adjustment workflow. If hidden purchases exist, public stock is marked partially visible rather than displaying a misleading balance.
- **Vendors:** purchases, cash paid, pending dues, last purchase and transaction history. Phone, address and notes are only in the admin projection. Vendors with linked invoices cannot be deleted.
- **Contributions:** money received from people, with contributor shares and individual entries. The name dropdown offers **Amit Mulmule**, **Sumit Mulmule**, and **Government**; an existing historical name is retained when editing its record. These options do not create fictional contribution records. Admin can add/edit/delete and choose public visibility.
- **Project:** actual project name, dates, current stage and explicitly selected completed stages. Spending never sets progress automatically.
- **Reports:** daily/weekly/monthly, categories, material purchases/usage, contractor costs, vendors, payments, pending dues and contributions. Reports distinguish incurred amounts from cash paid. CSV fields are escaped and protected from spreadsheet formula injection. Print from the browser to save a PDF.
- **History:** the admin can inspect the latest 100 audit events with before/after records. Public activity shows only permitted transactions. Alert badges are based on unpaid invoices, not invented due dates.

## Accounting and security model

One `expenses` row is the invoice/purchase. `expense_items` contains its individual material lines; these are the source for material stock and spending breakdowns. Invoice amounts must equal the sum of their material line totals. Legacy single-material columns are retained for backward compatibility; reports never count both sources. Material purchase reports show quantities and incurred costs by material/unit; cash paid and pending dues remain invoice-level amounts, not invented allocations to individual lines. `payments` reduce the balance without increasing incurred cost. `material_consumption` only changes stock. `labour_entries` adds contractor work metadata to an invoice without storing a second financial total. Contributions are project funding, not expenditure. INR amounts use PostgreSQL `numeric` and Decimal.js for consistent cents/paise. Quantities allow three decimals. Different units are distinct material identities.

Every base table has RLS. Client table grants are revoked: all writes must go through allowlisted, single-admin RPC functions. These check the stored `auth.uid()` against the sole admin profile, lock the project row, perform atomic changes and create private audit events. Unique request keys prevent duplicate creation on retries. Expense versions reject stale invoice edits. Deferred constraints prevent overpayment or insufficient stock even when multiple related rows change in a transaction.

`app_snapshot()` is the only public data projection. It explicitly selects allowed fields, filters hidden expenses/contributions, excludes private vendor data, payment references, receipt metadata and private audit history, and returns an admin projection only to the configured identity. It is a security-definer function with a fixed empty search path; it intentionally replaces public base-table reads. The frontend role only controls interface visibility; it grants no database authority. Disable hosted public signup as described above.

Database changes are atomic; an object upload and PostgreSQL transaction cannot be atomic together. Receipts upload to a new immutable private path first, then the invoice transaction links metadata. Confirmed SQL rejections clean up the new upload. If the network outcome is uncertain, the file stays private to avoid deleting a possibly committed receipt. Periodically inspect Storage for unreferenced files; never delete a path listed in `receipt_metadata`. Superseded/deleted objects are removed after a successful ledger mutation, with manual cleanup as a fallback. Signed URLs are bearer links until their short expiry: do not share them.

All screens invalidate shared query data after successful changes. Viewer sessions poll approximately once per minute and can refresh manually. There is no offline editing or background sync. A lost network response may require refreshing before retrying; request keys prevent duplicate invoices/payments. The snapshot reads a whole small personal ledger; a large multi-project deployment would need server-side pagination/aggregation before scaling.

## Tests and validation

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` uses embedded PostgreSQL (PGlite) to execute the migration with test Auth/Storage schemas. It checks role permissions, public-field privacy, accounting, payments, idempotency, stale edits, stock validation and rollback. It is not a substitute for testing the real hosted Supabase Auth and Storage services.

Browser checks use Chromium at 320, 360, 390, 768 and 1440px, check all main pages for horizontal overflow, and exercise mobile expense/receipt/payment/contribution/viewer workflows. On this Windows workspace, headless Edge can be used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE` set to its installed executable path. Final device verification should include Safari on an actual iPhone and Chrome on Android; Chromium emulation does not prove every Safari behavior.

Before entering real data, verify on your hosted project: anonymous reads, an unauthorized authenticated user's rejected write, your admin login, invoice editing and partial payments, private receipt upload/download, stock rejection and logout removing admin/private views. Download a CSV and compare its totals with the displayed records. These hosted checks require your Supabase project configuration and have not been claimed as completed.

## Free-tier limits and backups

Free services have quotas and may change. Supabase's published Free plan currently includes a 500 MB database and 1 GB file storage, with limited egress; inactive projects may pause after approximately seven days of low activity. Check the [Supabase pricing page](https://supabase.com/pricing) and [project pausing documentation](https://supabase.com/docs/guides/platform/free-project-pausing) before relying on availability. Keep receipt images compact; avoid storing photos of the entire build in the receipt bucket.

GitHub Pages on GitHub Free requires a public repository; its published site limit is 1 GB with a soft 100 GB/month bandwidth limit. See [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). No unlimited storage, traffic, continuous availability or permanent zero cost is promised. Monitor usage and do not upgrade plans or add paid services unless you choose to.

Export CSV reports regularly. CSV reports are readable summaries, not full restorable database backups. Use Supabase's supported database export/`pg_dump` process for full backups and retain private receipt files separately. Protect exports containing private records and credentials. Store no sensitive screenshots in the public GitHub repository.
