```md
# Odoo Tax Fix – Correct TTC Display (Multi-Company)

## Why this extension exists

When working with **Odoo 16 in multi-company / multi-store mode**, I encountered a critical UI issue:

👉 **Taxes are duplicated visually when multiple companies are selected**, which leads to an **incorrect displayed TTC (price including taxes)**.

Although the backend calculations remain correct, the **frontend display becomes misleading**, which is dangerous for:
- pricing decisions
- sales validation
- accounting checks
- daily operational use

This browser extension was created as a **non-intrusive, client-side fix** to restore trust in the displayed price — **without modifying Odoo’s source code**.

---

## The issue being solved

### Context
- Odoo 16 (on-premise)
- Multi-company enabled
- Same tax (e.g. `SUP 7%`) applied per company
- User selects multiple companies at once

### What goes wrong
Odoo **duplicates the tax tags** in the UI:

```

SUP × 5

```

Instead of:
```

SUP × 1

```

The displayed TTC is then calculated as if taxes were cumulative:

```

Broken logic (display only):
TTC ≈ HT × (1 + SUP×count + NOR×count)

````

Example:

| Value | Amount |
|-----|-------|
| HT | 7,756.075 DT |
| SUP | 7% |
| Companies | 5 |
| Displayed TTC (wrong) | 10,470.700 DT |
| Correct TTC | **8,299.000 DT** |

⚠️ **Backend data is correct — only the UI is wrong**, which makes this issue subtle and dangerous.

---

## What the extension does

✔ Detects duplicated tax tags (`SUP`, `NOR`)  
✔ Deduplicates them logically  
✔ Recomputes the **correct TTC using unique taxes only**  
✔ Displays the corrected price in a **modern floating card**  
✔ Optionally **replaces the incorrect Odoo TTC line**  
✔ Works **live** as Odoo re-renders the page  
✔ Does **not modify Odoo data** (read-only DOM manipulation)

---

## How the solution evolved (step by step)

### Step 1 – Observation
- Identified that the backend is correct
- Confirmed the issue is **purely frontend/UI**

### Step 2 – DOM analysis
Located stable DOM anchors:
- `div[name="pricing"]`
- `input#list_price`
- `div[name="tax_string"]`
- `.o_tag_badge_text`

These are consistent across Odoo 16 product forms.

### Step 3 – Initial proof of concept
- Read HT price from `list_price`
- Read tax tags (`SUP`, `NOR`)
- Deduplicate tax codes
- Compute corrected TTC

### Step 4 – Reverse calculation
In cases where HT is unavailable:
- Reverse HT from the **inflated TTC**
- Based on observed broken multiplier logic

### Step 5 – UI improvements
- Replaced debug output with a **clean card UI**
- Designed modern layout (rounded, glass, soft shadow)
- Added tax “chips” for clarity

### Step 6 – UX polish
- Anchored card under Odoo module icon
- Made the card **draggable**
- Added reset position
- Session-based position persistence

### Step 7 – Cross-browser support
- Firefox (Manifest V3)
- Chrome (Manifest V3)
- Same `content.js`, different manifests

---

## Tech stack

- **JavaScript (Vanilla)**
- **Browser Extension – Manifest V3**
- DOM observation via `MutationObserver`
- No external libraries
- No backend / API calls
- No storage outside the browser session

---

## Security & permissions

### Permissions used
- `content_scripts` on **explicitly defined local URLs**
- No access to:
  - cookies
  - local storage (except session position)
  - network requests
  - Odoo backend
  - user credentials

### What the extension does NOT do
❌ No data collection  
❌ No tracking  
❌ No analytics  
❌ No modification of Odoo database  
❌ No external communication  

Everything runs **locally in your browser only**.

---

## Disclaimer

⚠️ **This extension is a UI workaround**, not an official Odoo fix.

- It does **not change accounting logic**
- It does **not override backend behavior**
- It is meant for **visual clarity and operational safety**

Always rely on official Odoo accounting reports for final validation.

Use at your own risk.

---

## Installation instructions

### Firefox
1. Clone or download this repository
2. Open `about:debugging`
3. Click **This Firefox**
4. Click **Load Temporary Add-on**
5. Select `manifest.json`
6. Open an Odoo product page

### Chrome
1. Clone or download this repository
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder
6. Open an Odoo product page

---

## Configuration

Update `manifest.json` to match your Odoo URL:

```json
"matches": [
  "http://localhost:XXXX/*",
  "http://19X.XXX.XXX.X:XXX/*"
]
````

⚠️ Port number **must** be included if used.

---

## When should you use this?

✅ Multi-company Odoo setups
✅ On-premise deployments
✅ Users frequently switching companies
✅ Pricing validation workflows
❌ Not needed for single-company environments

---

## Final note

This extension exists because **a wrong price is worse than no price**.

If Odoo eventually fixes this UI behavior upstream, this project may become obsolete — and that would be a good thing.

Until then, this tool restores clarity, confidence, and sanity. 🧠💸
