# MT Bites POS — Coding Agent Handoff and Implementation Brief

You are the lead senior full-stack engineer, mobile UX designer, and QA engineer taking over an EXISTING React project. Work directly inside the already-open `mt-bites-pos` folder. Read the files before changing anything. **Do not create a new project, replace the app wholesale, erase local records, or start by deploying.** The client wants a real-world restaurant ordering product for MT Bites, a fast-food business in Kashmir, Pakistan, where internet service can fluctuate.

## Current state and environment

- App: `mt-bites-pos` v0.1, **React 19 + Vite 6 + Dexie/IndexedDB + lucide-react + vite-plugin-pwa**, JavaScript and existing CSS. It is currently a **single-device offline-first prototype**, not a secure production system.
- Development: Windows / VS Code; `npm.cmd install` and `npm.cmd run dev` (PowerShell may block `npm.ps1`, so use `npm.cmd`). Local dev `http://localhost:5173`, phone test via LAN address such as `http://192.168.18.60:5173` (not HTTPS). Dependencies already installed and Vite started successfully on the user's PC.
- Relevant files: `src/App.jsx` (currently ~333 lines with many components), `src/db.js` (Dexie schema, initialization, JSON backup/restore), `src/menu.js`, `src/menu-source.json` (menu seed), `src/money.js`, `src/receipt.js`, `src/styles.css`, `vite.config.js`, `netlify.toml`, `public/icons/*`, `tests/*`, `docs/menu-for-review.csv`, `README.md`.
- Existing sections: waiter new order/cart, unpaid orders, cash payment, kitchen/customer print HTML, demo dashboard, menu and price edits, manual inventory, expenses, backup/restore. The admin/waiter selection is currently **only an unprotected demo role selector**, not authentication. No real Supabase connection, shared sync or direct Bluetooth printing exists.
- Restaurant branding: **MT Bites**. Visual language should be distinctive, premium, welcoming, clean, touch-friendly, and restaurant-operational: charcoal/near-black, warm amber/orange accents, excellent readability. Don't sacrifice accessibility to visual effects.
- Menu was transcribed from six client menu photos: **88 distinct products, 122 priced product variants**, organized into burgers, pizzas, deals, BBQ, fish, wings, wraps, snacks, fries, drinks, shakes, desserts, etc. `src/menu-source.json` is the starting truth, not something to silently replace with sample menu. Owner needs to confirm two unlabeled Chicken Nuggets sizes and the units/servings for Fish Fry and Fish Grill. Preserve exact names and prices until approved.

## Priority zero — fix broken Save Order

The owner reports that tapping **Save Order** sometimes does nothing. Reproduce first in a desktop browser AND on Android over a local HTTP network URL; inspect developer console and IndexedDB. **Important suspected root cause:** `placeOrder()` in `src/App.jsx` builds an order with `id: crypto.randomUUID()` and `number: orderNumber()` BEFORE entering its try/catch; `orderNumber()` in `src/money.js` also calls `crypto.randomUUID()`. That API requires a secure context and may be unavailable on `http://192.168.x.x` mobile pages. This is a hypothesis to verify, not a completed diagnosis. Replace this dependency with a secure-context-independent, collision-resistant ID strategy compatible with intended browsers (e.g. a tested library based on `crypto.getRandomValues` where supported, with a deliberate compatibility strategy); keep permanent internal IDs separate from readable order numbers. Add robust error handling that covers the entire flow, conspicuous success/error feedback, save-in-progress/duplicate-tap protection, and logging useful for development without leaking customer details. Check IndexedDB failures, validation, blank required fields, and asynchronous reload errors as well. Ensure no silent failure.

**Required acceptance test:** add one Zinger Burger (Rs. 330) + one Small Tikka Pizza (Rs. 650), total Rs. 980, save as UNPAID, confirm in Orders, reload, confirm it persists, print preview kitchen/customer tickets, record cash, confirm it becomes PAID and dashboard cash total changes exactly once. Test desktop localhost and Android LAN HTTP or comparable insecure context. An empty cart should not save. Disabled buttons must clearly show why. Add regression tests.

## Main real-life workflow

1. Waiter signs into assigned account / opens an authorized offline session.
2. Select dine-in table (or takeaway), browse/search quick categories, tap products, choose sizes/variants, adjust quantity and instructions. Keep a visible sticky cart and clear final total.
3. Save the order atomically into local storage as **unpaid**. Immediately offer a **kitchen ticket** (items/quantities/table/notes, no prices) and a **customer bill** (unit prices, totals, order number, payment status). Kitchen prep begins.
4. Order statuses: New -> Preparing -> Ready -> Completed. Treat payment independently: Unpaid -> Paid (cash only initially). Support outstanding orders, explicit cash received and change, prevent duplicate payment; record staff identity and timestamps. Allow reprint without duplicating an order.
5. Admin manages products, variants, prices, availability, inventory receipts/adjustments, expenses, staff, and operational reports. Dashboard shows sales **from paid orders**, pending cash, cash collected, popular items, date filters, and low stock. Don't label revenue minus recorded expenses as true profit without ingredient costing and complete expense coverage.
6. Preserve product name, unit price and size snapshots in completed orders when current menu prices later change. Keep a safe audit trail for edits/voids/refunds later; no silent hard-deletion of transaction records.

## UI/UX overhaul — premium yet practical

- **Waiter-first phone design** for 360px+ screens, fast and legible when standing next to customers. Use large 44px+ touch targets, compact two-column product cards where readable, sticky category filters and search, bottom-sheet variant picker, stepper quantity changes, always-accessible View Cart, and prominent Save Order CTA.
- Show image, item name, exact price / `From Rs. ...` for multi-size items, availability, and size selection with minimal taps. Avoid oversized cards, scrolling through irrelevant admin features, tiny text or excessive animations.
- Professional loading, success, error, empty, confirmation and offline states. Strong design system (spacing, typographic scale, colors, dark/light contrast, buttons, fields, dialogs, icons); mobile-safe areas, keyboard handling and accessibility.
- **Admin desktop/tablet dashboard** with meaningful KPI cards, readable tables, search/filter/export, responsive charts if helpful, activity history and effective menu/inventory editors. Navigation should be role-specific. Reorganize `App.jsx` into maintainable components and services incrementally; preserve functionality and data migrations.
- All screens should feel like one coherent polished brand, not a generic admin template. Optimize load performance and work in slow/offline conditions. Do not depend on network fonts for critical UI.

## Food photography and branding

- Replace emoji-only product imagery with real, relevant food images, *without blindly scraping Google Images or copying copyrighted photos*. First inspect project assets and any client-provided images. If none, use appropriately licensed images from legitimate sources (such as Unsplash/Pexels, subject to their current license/usage rules), or an explicitly labeled temporary placeholder. Record each image source/credit/license where required.
- Match images truthfully to specific foods (pizza, zinger burger, fries, wings, fish, BBQ); **do not label stock photography as a photograph of MT Bites' own dish**. Prefer owner-supplied genuine food photos for final launch.
- Download/optimize approved assets into local project files (compressed WebP/AVIF and responsive thumbnails) instead of relying on third-party image URLs. This matters because the POS must display images offline. Add lazy-loading, graceful fallbacks and low-overhead assets. Don't pull a giant image library for 88 items or make the PWA huge.
- Provide an admin image upload/replace function if feasible, with file validation, compression, reasonable size limits, and offline persistence considerations. Keep existing product IDs and names/prices intact.

## Secure admin and waiter authentication — not a fake client-side switch

- No anonymous public waiter registration or public admin registration. The **owner/admin is provisioned deliberately**; admin signs in securely and **creates/invites/approves waiters**. Each waiter gets a unique account and can change credentials. Support disabled/deactivated users; password reset/recovery; optional simple staff PIN for quick re-entry only after secure provisioning if justified.
- Roles: Admin/Owner = menu, price, inventory, staff, financial reports, settings and backup; Waiter = menu browse, new orders, own/relevant orders, status and allowed cash checkout, no access to admin financial settings or staff management. Define access matrix before implementation.
- Client-side screen hiding is **not security**. Choose and implement a genuine authentication/authorization solution suitable for a Netlify-hosted PWA, most likely Supabase Auth + Postgres + Row Level Security + carefully scoped server/edge functions for privileged staff provisioning. Never embed Supabase service-role keys, admin credentials or other secrets in browser code; secrets go only on the trusted server. Never store plaintext passwords. Use least privilege, validation, rate limiting as available and a clear session logout policy.
- **Offline-first auth has unavoidable limitations**: the first login/registration and cloud verification need connectivity; an already-provisioned device may support appropriately constrained cached offline access according to an explicit security design. Define how long sessions remain valid, how offline edits are tagged, and how revocation takes effect after reconnecting. Do not claim immediate revocation or secure multi-user isolation while fully disconnected unless implemented and tested. If secure authentication/synchronization can't be completed in this iteration, keep an explicitly labeled dev mode (not production safe) and document the production blockers; don't pretend the demo role dropdown is secure.
- If using Supabase, use migrations, RLS policies tested by role, and idempotent sync keyed by stable IDs. Reconcile errors visibly, never lose locally saved orders on network failure. Do not deploy private/operational data or production user creation before proper controls exist.

## Offline and multi-device constraints

- Core waiter experience must function on an already-installed PWA without internet, storing menu, cart, orders and pending cash locally in IndexedDB (Dexie). Use appropriate service worker precaching and test after production build via HTTPS or localhost. Regular phone LAN `http://192.168.x.x` generally is **not a secure context for service workers**; don't claim offline PWA installation is tested solely by Vite LAN HTTP.
- Local IndexedDB is device/browser-specific and can be cleared; offer export/download and import/restore with warnings, versioned migrations, backup integrity checks, and no destructive changes without data safety measures.
- **Netlify hosts static frontend**; it does not by itself keep multiple offline phones in sync. A future Supabase service can sync orders when online; true live cross-phone collaboration during internet outages requires a local Wi-Fi server or another local transport. State limitations prominently. Include sync status and conflict handling design if adding sync.
- Cash only for now. Don't introduce premature card payment processing, payment gateway complexity, delivery logistics, automated ingredient deductions or comprehensive accounting until approved.

## Printing

- Keep reliable browser print preview for now, build clean **58mm and 80mm thermal receipt CSS** and let admin select format. Kitchen ticket includes no prices; customer receipt lists amounts and unpaid/paid state, order number, date/time, table and restaurant branding. Print/reprint previous tickets without new sales.
- The client does NOT own a printer yet. Do not falsely promise direct Bluetooth ESC/POS compatibility until a concrete printer model is tested. Clearly distinguish browser print dialog versus future native/direct Bluetooth integration. Provide a testable print-preview flow that works today.

## Engineering and verification standards

1. Audit the existing code and write a brief findings/priorities summary; take a data backup before schema changes. Don't reset IndexedDB silently or reseed over owner edits.
2. Prioritize in this order: **(P0) fix Save Order and persistence**, (P1) polished waiter POS and menu photography, (P2) admin dashboard/menu/inventory, (P3) proper authentication/role security, (P4) offline reliability, printing and reporting, (P5) GitHub/Netlify deployment readiness. You may reorder security prerequisites needed for production; do not ship insecure roles publicly as production.
3. Make actual edits in the existing repo, not just advice or mockups. Keep code modular and readable. Prefer minimal safe dependencies. Add automated unit/component/integration tests for money/order/authorization; use Playwright or similar for key UI flows if feasible. Test save across refresh, duplicate taps, refunds/voids if implemented, disconnected use, menu edits vs historic receipts, staff permissions and browser/mobile viewport.
4. Run `npm.cmd test`, `npm.cmd run build`, and local app checks, fix errors, then report exact results, changed files, unresolved risks and reproduction steps. Don't claim to have physically tested a printer or mobile browser if not done.
5. Preserve Netlify support (`npm run build`, publish `dist`, SPA fallback) and GitHub-friendly `.gitignore`; `.env` secrets are never committed. **Do not deploy or push to GitHub without asking the user first.** Focus on a robust, beautiful local app the client can demonstrate.
6. Ask only narrowly necessary questions, such as preferred product photos, whether client wants offline-only single-phone login or cloud-backed multi-account security, printer choice, and any unclear menu prices. Implement sensible reversible defaults and clearly mark placeholders.

## Deliverables

- A working, locally runnable upgraded MT Bites POS in the existing folder, not a second scaffold.
- Fixed Save Order and automated regression coverage.
- Optimized mobile waiter workflow, improved admin layout, accurately seeded menu and offline-capable product images.
- Real security design / implementation for admin and invited waiter accounts, with remaining limitations explicit.
- Reliable printable kitchen tickets and customer bills, offline data and backups.
- Updated README including Windows PowerShell `npm.cmd` commands, how to test, architectural decisions, issues requiring owner approval, and steps for a later GitHub + Netlify deployment.

Begin by reading `README.md`, `package.json`, `src/App.jsx`, `src/db.js`, `src/money.js`, `src/receipt.js`, `src/menu-source.json`, `src/styles.css` and the tests. Then **fix Save Order before UI work**. Show working results, not only a plan.
