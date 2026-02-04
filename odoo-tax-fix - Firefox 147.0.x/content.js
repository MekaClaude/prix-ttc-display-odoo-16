(() => {
  // ===== CONFIG =====
  const TAX_RATES = { SUP: 0.07, NOR: 0.19 }; // define your Taxes and the tag here to be accurate

  const PRICING_SELECTOR = 'div[name="pricing"]';
  const LIST_PRICE_INPUT_SELECTOR = `${PRICING_SELECTOR} input#list_price`;
  const TAX_STRING_SELECTOR = `${PRICING_SELECTOR} div[name="tax_string"] span`;
  const TAX_TAG_SELECTOR = "div.o_tag_badge_text";

  const OVERLAY_ID = "odoo-tax-fix-overlay";
  const POS_KEY = "odoo_tax_fix_pos_v1"; // session memory key

  // ===== HELPERS =====
  function parseMoney(text) {
    if (!text) return null;
    let cleaned = text
      .replace(/\u00A0/g, " ")
      .replace(/[^\d.,\- ]+/g, " ")
      .trim();

    const m = cleaned.match(/-?[\d ]+[.,]\d+|-?[\d ]+/);
    if (!m) return null;

    let num = m[0].replace(/ /g, "");
    const hasComma = num.includes(",");
    const hasDot = num.includes(".");
    if (hasComma && hasDot) {
      if (num.lastIndexOf(".") > num.lastIndexOf(",")) num = num.replace(/,/g, "");
      else num = num.replace(/\./g, "").replace(",", ".");
    } else if (hasComma && !hasDot) {
      num = num.replace(",", ".");
    }

    const val = Number(num);
    return Number.isFinite(val) ? val : null;
  }

  function formatDT(value, decimals = 3) {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  function sumUniqueRates(uniqueCodes) {
    let sum = 0;
    for (const code of uniqueCodes) sum += TAX_RATES[code] || 0;
    return sum;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // ===== NAVBAR ANCHOR (initial placement only) =====
  function findModuleIconAnchor() {
    const candidates = [
      ".o_main_navbar .o_menu_systray",
      ".o_main_navbar .o_menu_systray .o_menu_systray_item",
      ".o_main_navbar .o_menu_toggle",
      ".o_main_navbar .dropdown-toggle",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.getClientRects().length) return el;
    }
    return null;
  }

  function getSavedPos() {
    try {
      const raw = sessionStorage.getItem(POS_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (typeof obj?.left === "number" && typeof obj?.top === "number") return obj;
      return null;
    } catch {
      return null;
    }
  }

  function savePos(left, top) {
    try {
      sessionStorage.setItem(POS_KEY, JSON.stringify({ left, top }));
    } catch {
      // ignore
    }
  }

  // ===== UI: Modern Card + Draggable =====
  function injectStylesOnce() {
    const id = "odoo-tax-fix-styles";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      #${OVERLAY_ID}{
        position: fixed;
        z-index: 999999;
        width: 320px;
        border-radius: 18px;
        background: rgba(255,255,255,0.78);
        box-shadow: 0 18px 50px rgba(0,0,0,0.18);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1px solid rgba(255,255,255,0.6);
        overflow: hidden;
        user-select: none;
      }

      #${OVERLAY_ID} .otf-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        padding: 14px 14px 10px 14px;
        cursor: grab;
      }
      #${OVERLAY_ID}.otf-dragging .otf-header{
        cursor: grabbing;
      }

      #${OVERLAY_ID} .otf-title{
        display:flex;
        flex-direction:column;
        gap: 2px;
        min-width: 0;
      }
      #${OVERLAY_ID} .otf-title h3{
        margin:0;
        font-size: 18px;
        line-height: 1.1;
        font-weight: 800;
        color: #111;
        letter-spacing: -0.2px;
      }
      #${OVERLAY_ID} .otf-title .otf-sub{
        margin:0;
        font-size: 12px;
        color: rgba(0,0,0,0.60);
        white-space: nowrap;
        overflow:hidden;
        text-overflow: ellipsis;
      }

      #${OVERLAY_ID} .otf-actions{
        display:flex;
        align-items:center;
        gap: 8px;
        flex-shrink: 0;
      }

      #${OVERLAY_ID} .otf-btn{
        width: 34px;
        height: 34px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.06);
        background: rgba(255,255,255,0.65);
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        transition: transform 120ms ease, background 120ms ease;
      }
      #${OVERLAY_ID} .otf-btn:hover{
        transform: translateY(-1px);
        background: rgba(255,255,255,0.9);
      }
      #${OVERLAY_ID} .otf-btn:active{
        transform: translateY(0px);
      }

      #${OVERLAY_ID} .otf-grip{
        width: 34px;
        height: 34px;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.06);
        background: rgba(255,255,255,0.35);
        display:flex;
        align-items:center;
        justify-content:center;
      }
      #${OVERLAY_ID} .otf-grip svg{
        opacity: 0.55;
      }

      #${OVERLAY_ID} .otf-body{
        padding: 0 14px 14px 14px;
      }

      #${OVERLAY_ID} .otf-hero{
        border-radius: 16px;
        padding: 14px;
        background: rgba(186, 228, 255, 0.42);
        border: 1px solid rgba(0,0,0,0.04);
        margin-bottom: 12px;
      }
      #${OVERLAY_ID} .otf-hero .otf-hero-label{
        font-size: 12px;
        color: rgba(0,0,0,0.55);
        margin-bottom: 4px;
      }
      #${OVERLAY_ID} .otf-hero .otf-hero-value{
        font-size: 26px;
        font-weight: 900;
        letter-spacing: -0.4px;
        color: #0b0b0b;
        line-height: 1.1;
      }

      #${OVERLAY_ID} .otf-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 10px;
        padding: 8px 2px;
      }
      #${OVERLAY_ID} .otf-row .k{
        font-size: 12px;
        color: rgba(0,0,0,0.60);
      }
      #${OVERLAY_ID} .otf-row .v{
        font-size: 12px;
        font-weight: 700;
        color: rgba(0,0,0,0.82);
        text-align: right;
      }

      #${OVERLAY_ID} .otf-chips{
        display:flex;
        flex-wrap:wrap;
        gap: 8px;
        padding: 6px 0 2px 0;
      }
      #${OVERLAY_ID} .otf-chip{
        padding: 7px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        background: rgba(255,255,255,0.70);
        border: 1px solid rgba(0,0,0,0.05);
        color: rgba(0,0,0,0.78);
      }

      #${OVERLAY_ID} .otf-footer{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap: 10px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(0,0,0,0.06);
        color: rgba(0,0,0,0.55);
        font-size: 11px;
      }
      #${OVERLAY_ID} .otf-link{
        cursor:pointer;
        font-weight: 700;
        color: rgba(0,0,0,0.70);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    injectStylesOnce();
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;

    el = document.createElement("div");
    el.id = OVERLAY_ID;

    el.innerHTML = `
      <div class="otf-header">
        <div class="otf-title">
          <h3>Odoo Tax Fix</h3>
          <p class="otf-sub" id="otf-subtitle">Correct TTC (unique taxes)</p>
        </div>
        <div class="otf-actions">
          <div class="otf-grip" title="Drag">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="5" cy="5" r="1.2" fill="currentColor"></circle>
              <circle cx="11" cy="5" r="1.2" fill="currentColor"></circle>
              <circle cx="5" cy="11" r="1.2" fill="currentColor"></circle>
              <circle cx="11" cy="11" r="1.2" fill="currentColor"></circle>
            </svg>
          </div>
          <button class="otf-btn" id="otf-close" title="Close" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="otf-body">
        <div class="otf-hero">
          <div class="otf-hero-label">TTC corrigé</div>
          <div class="otf-hero-value" id="otf-ttc">—</div>
        </div>

        <div class="otf-row">
          <div class="k">HT</div>
          <div class="v" id="otf-ht">—</div>
        </div>

        <div class="otf-row">
          <div class="k">Taxes uniques</div>
          <div class="v" id="otf-unique">—</div>
        </div>

        <div class="otf-chips" id="otf-chips"></div>

        <div class="otf-row">
          <div class="k">TTC affiché (Odoo)</div>
          <div class="v" id="otf-odoo-ttc">—</div>
        </div>

        <div class="otf-footer">
          <div>Tip: drag the header</div>
          <div class="otf-link" id="otf-reset">Reset position</div>
        </div>
      </div>
    `;

    document.body.appendChild(el);

    // close
    el.querySelector("#otf-close")?.addEventListener("click", () => el.remove());

    // reset position
    el.querySelector("#otf-reset")?.addEventListener("click", () => {
      sessionStorage.removeItem(POS_KEY);
      placeUnderIcon(el);
    });

    // drag
    makeDraggable(el);

    // initial placement
    const saved = getSavedPos();
    if (saved) {
      setOverlayPos(el, saved.left, saved.top);
    } else {
      placeUnderIcon(el);
    }

    return el;
  }

  function setOverlayPos(el, left, top) {
    const w = el.offsetWidth || 320;
    const h = el.offsetHeight || 220;

    const x = clamp(left, 8, window.innerWidth - w - 8);
    const y = clamp(top, 8, window.innerHeight - h - 8);

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.right = "auto";
    savePos(x, y);
  }

  function placeUnderIcon(el) {
    const anchor = findModuleIconAnchor();
    if (!anchor) {
      setOverlayPos(el, window.innerWidth - (el.offsetWidth || 320) - 12, 58);
      return;
    }

    const r = anchor.getBoundingClientRect();
    const gap = 10;
    const top = Math.round(r.bottom + gap);

    const w = el.offsetWidth || 320;
    let left = Math.round(r.right - w);
    left = clamp(left, 8, window.innerWidth - w - 8);

    setOverlayPos(el, left, top);
  }

  function makeDraggable(el) {
    const header = el.querySelector(".otf-header");
    if (!header) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setOverlayPos(el, startLeft + dx, startTop + dy);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("otf-dragging");
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };

    header.addEventListener("pointerdown", (e) => {
      // Don't start drag if clicking close/reset buttons
      const target = e.target;
      if (target && (target.closest("#otf-close") || target.closest("#otf-reset"))) return;

      dragging = true;
      el.classList.add("otf-dragging");
      header.setPointerCapture?.(e.pointerId);

      const rect = el.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerUp, true);
    });
  }

  function setCardValues({ ht, uniqueCodes, correctedTTC, displayedTTC }) {
    const el = ensureOverlay();

    const htEl = el.querySelector("#otf-ht");
    const uniqueEl = el.querySelector("#otf-unique");
    const chipsEl = el.querySelector("#otf-chips");
    const ttcEl = el.querySelector("#otf-ttc");
    const odooEl = el.querySelector("#otf-odoo-ttc");

    if (ttcEl) ttcEl.textContent = correctedTTC !== null ? `${formatDT(correctedTTC)} DT` : "—";
    if (htEl) htEl.textContent = ht !== null ? `${formatDT(ht)} DT` : "—";
    if (uniqueEl) uniqueEl.textContent = uniqueCodes.length ? uniqueCodes.join(" + ") : "Aucune";
    if (odooEl) odooEl.textContent = displayedTTC !== null ? `${formatDT(displayedTTC)} DT` : "—";

    if (chipsEl) {
      chipsEl.innerHTML = "";
      // Chips like the example
      if (!uniqueCodes.length) {
        const chip = document.createElement("div");
        chip.className = "otf-chip";
        chip.textContent = "No tax";
        chipsEl.appendChild(chip);
      } else {
        for (const code of uniqueCodes) {
          const chip = document.createElement("div");
          chip.className = "otf-chip";
          chip.textContent = code === "SUP" ? "SUP 7%" : code === "NOR" ? "NOR 19%" : code;
          chipsEl.appendChild(chip);
        }
      }
    }
  }

  // ===== READ ODOO VALUES =====
  function readHT() {
    const input = document.querySelector(LIST_PRICE_INPUT_SELECTOR);
    if (!input) return null;
    return parseMoney((input.value || "").trim());
  }

  function readTaxes() {
    const els = document.querySelectorAll(TAX_TAG_SELECTOR);
    const counts = { SUP: 0, NOR: 0 };

    for (const el of els) {
      const t = (el.textContent || "").trim().toUpperCase();
      if (t === "SUP") counts.SUP++;
      if (t === "NOR") counts.NOR++;
    }

    const unique = [];
    if (counts.SUP > 0) unique.push("SUP");
    if (counts.NOR > 0) unique.push("NOR");

    return { counts, unique };
  }

  function readDisplayedTTC() {
    const span = document.querySelector(TAX_STRING_SELECTOR);
    if (!span) return null;
    return parseMoney((span.textContent || "").trim());
  }

  function reverseHTFromInflatedTTC(inflatedTTC, counts) {
    // inflated ≈ HT * (1 + SUP_count*0.07 + NOR_count*0.19)
    const mult = 1 + counts.SUP * TAX_RATES.SUP + counts.NOR * TAX_RATES.NOR;
    if (!mult || mult <= 0) return null;
    return inflatedTTC / mult;
  }

  function computeCorrectTTC(ht, uniqueCodes) {
    return ht * (1 + sumUniqueRates(uniqueCodes));
  }

  function patchTaxString(correctTTC) {
    const span = document.querySelector(TAX_STRING_SELECTOR);
    if (!span) return;
    span.textContent = `(= ${formatDT(correctTTC)} DT toutes taxes comprises)`;
  }

  // ===== MAIN UPDATE =====
  function update() {
    const taxes = readTaxes();
    const displayedTTC = readDisplayedTTC();
    let ht = readHT();

    if (ht === null && displayedTTC !== null) {
      ht = reverseHTFromInflatedTTC(displayedTTC, taxes.counts);
    }

    if (ht === null) {
      setCardValues({
        ht: null,
        uniqueCodes: [],
        correctedTTC: null,
        displayedTTC: displayedTTC,
      });
      return;
    }

    const correctedTTC = computeCorrectTTC(ht, taxes.unique);

    setCardValues({
      ht,
      uniqueCodes: taxes.unique,
      correctedTTC,
      displayedTTC,
    });

    patchTaxString(correctedTTC);
  }

  // ===== OBSERVE ODOO RERENDERS =====
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      update();
    });
  }

  function install() {
    update();

    const mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });

    document.addEventListener("input", schedule, true);
    document.addEventListener("click", schedule, true);

    // keep card within viewport if window changes
    window.addEventListener("resize", () => {
      const el = document.getElementById(OVERLAY_ID);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setOverlayPos(el, rect.left, rect.top);
    });
  }

  install();
})();
