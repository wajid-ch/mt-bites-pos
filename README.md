# MT Bites — Offline-First Restaurant POS (v0.2)

A fast, mobile-first restaurant ordering and management system tailored for **MT Bites** in Kashmir, Pakistan, where internet connectivity can fluctuate. Built with **React 19, Vite 6, Dexie.js / IndexedDB, and PWA precaching**.

Contains **88 products with 122 priced options**, genuine food imagery optimized into local WebP assets for 100% offline access, thermal receipt formatting (58mm and 80mm), role-based offline authentication, and a robust order saving engine.

---

## Quick Start on Windows

Open VS Code / PowerShell in this directory. If Windows PowerShell restricts `.ps1` scripts, use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

Vite will start at `http://localhost:5173`. To test on an Android phone over your local Wi-Fi network, open the LAN address printed by Vite (e.g. `http://192.168.18.60:5173`).

### Running Tests & Building

```powershell
npm.cmd test
npm.cmd run build
```

---

## Default Staff Login Credentials

The prototype demo dropdown has been replaced with authentic role-based security:

| Role | Username | Default PIN | Access Level |
|---|---|---|---|
| **Owner / Manager** | `admin` | `2026` | Full Access (POS, Orders, Dashboard, Menu/Prices, Inventory, Expenses, Staff, Settings) |
| **Floor Waiter** | `waiter1` | `1234` | Restricted Access (Take Orders, View Orders, Collect Cash, Print Receipts) |

*The Owner can add, edit, disable, or reset PINs for any employee under **Staff & Security**.*

---

## Key Solutions & Architecture

### 1. Fixed "Save Order" Failure (Priority 0 & 1)
- **Root Cause Identified**: Previous code invoked `crypto.randomUUID()` in `money.js` and `App.jsx` outside error boundaries. `crypto.randomUUID` is a restricted Web API available **only in secure contexts** (HTTPS or localhost). When an Android phone accessed the POS over local Wi-Fi via `http://192.168.x.x`, `crypto.randomUUID` was `undefined`, throwing an uncaught exception and silently freezing the Save Order button.
- **Solution**: Implemented `src/id.js` using an RFC4122 v4 collision-resistant ID generator that leverages `crypto.getRandomValues` (available even in insecure HTTP contexts) with a high-resolution monotonic fallback. Order saving is enclosed in atomic database transactions with duplicate-tap protection (`saveInProgress` lock and `isSaving` spinner), comprehensive try/catch boundaries, and instant user toasts.
- **Acceptance Test**: Verified with automated tests in `tests/id.test.js` and `tests/orders.test.js` (including 1 Zinger Burger Rs. 330 + 1 Small Tikka Pizza Rs. 650 = Rs. 980 total).

### 2. Waiter-First Phone Experience (Priority 2)
- Designed specifically for 360px+ smartphone screens held by waiters on the restaurant floor.
- Two-column compact food cards featuring crisp food photography, bold names, and instant `+` add buttons.
- Sticky category pills (`All`, `Burgers`, `Classic Pizza`, `BBQ`, `Fish`, `Wings`, `Fries`, `Drinks`, etc.) and instant live search.
- Smooth bottom-sheet variant selector for multi-size products (Pizzas, Platters, Fries).
- Quick table number chips (`T1` through `T8` + custom input) and `Dine-in` / `Takeaway` toggle.
- Slide-up cart drawer with 44px+ touch-friendly stepper buttons (`+` / `-`), kitchen instruction notes, and whole-rupee discount validation.
- Floating mobile "View Order" CTA with live total.

### 3. Professional Offline Food Imagery (Priority 3)
- Converted category visuals into lightweight, high-quality **WebP assets** stored in `public/images/food/`.
- Average image size is only ~35–60 KB (total image payload < 600 KB), ensuring instant loading and offline PWA caching without consuming device storage.
- Admin image upload/replace feature: compresses uploaded photos directly on the device using HTML5 canvas before storing in IndexedDB.
- Preserved all 88 authentic MT Bites dishes and 122 priced variants.

### 4. Thermal Printing & Receipts (Priority 5)
- Supports both **58mm (mobile thermal rolls)** and **80mm (counter rolls)**, selectable under Settings.
- **Kitchen Ticket**: Order #, Date/Time, Table #, Staff name, items, quantities, variant notes, and kitchen instructions. **No prices shown**.
- **Customer Bill**: Complete itemized bill, subtotal, discount, net total, and **CASH PAID** / **UNPAID** status with cash received and change returned.
- Non-blocking browser print preview flow compatible with standard thermal drivers.

### 5. Admin Analytics & Inventory (Priority 6)
- **Dashboard**: Today's paid sales (calculated strictly from orders with `paymentStatus === 'paid'`), pending cash, orders taken, and 7-day sales bar chart.
- **Inventory**: Manual ingredient tracking, minimum stock thresholds, low-stock warnings, and stock movement logs.
- **Expenses**: Record restaurant cash expenses (Electricity, Gas, Rent, Staff Meals, Packaging, etc.).
- **Data Protection**: One-click full JSON database backup and restore, plus Excel-compatible sales CSV export.

---

## Items Flagged for Owner Confirmation

The following 4 items from the original menu photo transcription are flagged for final owner verification in `src/menu-source.json` (also marked with "Review" badges in the POS):
1. **Chicken Nuggets** (2 unnamed portion sizes listed in menu photo: Rs. 330 and Rs. 550 — confirm pieces, e.g. 6 pcs vs 10 pcs).
2. **Fish Fry** (Rs. 450 — confirm portion / weight).
3. **Fish Grill** (Rs. 450 — confirm portion / weight).

---

## Future GitHub & Netlify Deployment Steps

> **Note**: Do not push or deploy until approved by the owner.

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "MT Bites POS v0.2 - Fixed Save Order, mobile UX, offline food images, and staff security"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mt-bites-pos.git
git push -u origin main
```

### 2. Connect to Netlify
1. Log in to [Netlify](https://app.netlify.com/) and select **Add new site → Import an existing project**.
2. Select your GitHub repository.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy. Netlify will provide an HTTPS domain (e.g. `https://mt-bites-pos.netlify.app`).

### 3. Installing on Android Devices
1. Open the Netlify HTTPS URL in Chrome on an Android phone.
2. Tap the browser menu (⋮) → **Install app** or **Add to Home screen**.
3. Open the installed app once while connected so the service worker caches the full PWA shell and food images.
4. Test in airplane mode — take orders, save to local IndexedDB, and print tickets offline.
