(function () {
  "use strict";

  // ---------- Storage ----------
  const STORE_KEYS = { tx: "ft_transactions", cat: "ft_categories", recurring: "ft_recurring", incomeSplit: "ft_income_split", assets: "ft_external_assets" };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("Error leyendo", key, e);
      return fallback;
    }
  }
  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const DEFAULT_CATEGORIES = [
    { id: uid(), name: "Salario", type: "income", scope: "personal" },
    { id: uid(), name: "Freelance", type: "income", scope: "personal" },
    { id: uid(), name: "Inversiones", type: "income", scope: "ambos" },
    { id: uid(), name: "Vivienda", type: "expense", scope: "personal", bucket: "costes" },
    { id: uid(), name: "Alimentación", type: "expense", scope: "personal", bucket: "costes" },
    { id: uid(), name: "Transporte", type: "expense", scope: "personal", bucket: "costes" },
    { id: uid(), name: "Salud", type: "expense", scope: "personal", bucket: "costes" },
    { id: uid(), name: "Entretenimiento", type: "expense", scope: "personal", bucket: "caprichos" },
    { id: uid(), name: "Educación", type: "expense", scope: "personal", bucket: "costes" },
    { id: uid(), name: "Donaciones y regalos", type: "expense", scope: "personal", bucket: "donaciones" },
    { id: uid(), name: "Ventas", type: "income", scope: "empresa" },
    { id: uid(), name: "Servicios prestados", type: "income", scope: "empresa" },
    { id: uid(), name: "Nómina", type: "expense", scope: "empresa" },
    { id: uid(), name: "Renta", type: "expense", scope: "empresa" },
    { id: uid(), name: "Servicios (luz, internet)", type: "expense", scope: "empresa" },
    { id: uid(), name: "Marketing", type: "expense", scope: "empresa" },
    { id: uid(), name: "Insumos / Inventario", type: "expense", scope: "empresa" },
    { id: uid(), name: "Impuestos", type: "expense", scope: "empresa" },
    { id: uid(), name: "Otros", type: "expense", scope: "ambos", bucket: "costes" },
    { id: uid(), name: "Otros ingresos", type: "income", scope: "ambos" },
  ];

  const DEFAULT_INCOME_SPLIT = { ahorro: 50, inversion: 10, donaciones: 10, caprichos: 10, costes: 20 };
  const BUCKET_LABELS = { ahorro: "Ahorro", inversion: "Inversión", donaciones: "Donaciones y regalos", caprichos: "Caprichos", costes: "Costes de vida" };
  const ACCUMULATION_BUCKETS = new Set(["ahorro", "inversion", "donaciones"]);

  // ---------- State ----------
  const state = {
    transactions: load(STORE_KEYS.tx, []),
    categories: load(STORE_KEYS.cat, null) || DEFAULT_CATEGORIES,
    recurring: load(STORE_KEYS.recurring, []), // {id, name, category, scope, amount}
    incomeSplit: load(STORE_KEYS.incomeSplit, null) || DEFAULT_INCOME_SPLIT,
    externalAssets: load(STORE_KEYS.assets, []), // {id, name, amount, bucket}
    scope: "all", // all | personal | empresa
    month: currentMonthStr(),
    allTime: false,
    activeTab: "dashboard",
    editingTxId: null,
  };
  if (!load(STORE_KEYS.cat, null)) save(STORE_KEYS.cat, state.categories);

  function persistTx() { save(STORE_KEYS.tx, state.transactions); }
  function persistCat() { save(STORE_KEYS.cat, state.categories); }
  function persistIncomeSplit() { save(STORE_KEYS.incomeSplit, state.incomeSplit); }
  function persistRecurring() { save(STORE_KEYS.recurring, state.recurring); }
  function persistAssets() { save(STORE_KEYS.assets, state.externalAssets); }

  // ---------- Habits: Storage & State ----------
  const HT_KEYS = {
    habits: "ht_habits",
    completions: "ht_completions",
    rewards: "ht_rewards",
    redemptions: "ht_redemptions",
    weeklyGoal: "ht_weekly_goal",
  };

  const habitsState = {
    habits: load(HT_KEYS.habits, []), // {id, name, points}
    completions: load(HT_KEYS.completions, []), // {id, habitId, date}
    rewards: load(HT_KEYS.rewards, []), // {id, name, cost}
    redemptions: load(HT_KEYS.redemptions, []), // {id, rewardId, name, cost, date}
    weeklyGoal: load(HT_KEYS.weeklyGoal, 100),
    activeTab: "today",
    editingHabitId: null,
    editingRewardId: null,
    weekViewStart: weekStartStr(new Date()),
  };

  function persistHabits() { save(HT_KEYS.habits, habitsState.habits); }
  function persistCompletions() { save(HT_KEYS.completions, habitsState.completions); }
  function persistRewards() { save(HT_KEYS.rewards, habitsState.rewards); }
  function persistRedemptions() { save(HT_KEYS.redemptions, habitsState.redemptions); }
  function persistWeeklyGoal() { save(HT_KEYS.weeklyGoal, habitsState.weeklyGoal); }

  // ---------- Helpers ----------
  function currentMonthStr() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function monthOf(dateStr) { return dateStr.slice(0, 7); }
  function monthLabel(monthStr) {
    const [y, m] = monthStr.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString("es-MX", { month: "short", year: "numeric" });
  }
  const currencyFormatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  function fmtMoney(n) {
    return currencyFormatter.format(n);
  }
  function lastNMonths(n) {
    const out = [];
    const d = new Date();
    d.setDate(1);
    for (let i = n - 1; i >= 0; i--) {
      const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(dd.getFullYear() + "-" + String(dd.getMonth() + 1).padStart(2, "0"));
    }
    return out;
  }
  const PALETTE = ["#4f46e5", "#0ea5e9", "#16a34a", "#d97706", "#dc2626", "#9333ea", "#0d9488", "#e11d48", "#65a30d", "#7c3aed"];

  function scopeMatches(txScope, filterScope) {
    return filterScope === "all" || txScope === filterScope;
  }

  function categoriesFor(type, scope) {
    return state.categories.filter(c => c.type === type && (c.scope === "ambos" || c.scope === scope));
  }

  function getFiltered({ scope, month, allTime }) {
    return state.transactions.filter(t => {
      if (!scopeMatches(t.scope, scope)) return false;
      if (!allTime && monthOf(t.date) !== month) return false;
      return true;
    });
  }

  // ---------- Habits: Helpers ----------
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function todayStr() { return isoDate(new Date()); }

  function weekStartStr(d) {
    const dd = new Date(d);
    const day = dd.getDay(); // 0=Sun..6=Sat
    const diffToMonday = day === 0 ? 6 : day - 1;
    dd.setDate(dd.getDate() - diffToMonday);
    return isoDate(dd);
  }

  function habitCompletedOn(habitId, date) {
    return habitsState.completions.some(c => c.habitId === habitId && c.date === date);
  }

  function toggleCompletion(habitId, date) {
    const existing = habitsState.completions.find(c => c.habitId === habitId && c.date === date);
    if (existing) {
      habitsState.completions = habitsState.completions.filter(c => c !== existing);
    } else {
      habitsState.completions.push({ id: uid(), habitId, date });
    }
    persistCompletions();
  }

  function streakFor(habitId) {
    const doneDates = new Set(habitsState.completions.filter(c => c.habitId === habitId).map(c => c.date));
    const d = new Date();
    let cur = isoDate(d);
    if (!doneDates.has(cur)) {
      d.setDate(d.getDate() - 1);
      cur = isoDate(d);
    }
    let count = 0;
    while (doneDates.has(cur)) {
      count++;
      d.setDate(d.getDate() - 1);
      cur = isoDate(d);
    }
    return count;
  }

  function pointsEarnedTotal() {
    return habitsState.completions.reduce((sum, c) => {
      const h = habitsState.habits.find(x => x.id === c.habitId);
      return sum + (h ? h.points : 0);
    }, 0);
  }

  function pointsSpentTotal() {
    return habitsState.redemptions.reduce((sum, r) => sum + r.cost, 0);
  }

  function pointsBalance() {
    return pointsEarnedTotal() - pointsSpentTotal();
  }

  function pointsForWeek(weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endStr = isoDate(end);
    return habitsState.completions.reduce((sum, c) => {
      if (c.date < weekStart || c.date > endStr) return sum;
      const h = habitsState.habits.find(x => x.id === c.habitId);
      return sum + (h ? h.points : 0);
    }, 0);
  }

  // ---------- DOM refs ----------
  const $ = sel => document.querySelector(sel);

  // ---------- Confirm modal & toast (replace native confirm/alert, which some
  // browsers/embedded views block for local files) ----------
  const confirmOverlay = $("#confirmModalOverlay");
  let confirmCallback = null;
  function showConfirm(message, onConfirm, confirmLabel) {
    $("#confirmMessage").textContent = message;
    $("#confirmOkBtn").textContent = confirmLabel || "Eliminar";
    confirmCallback = onConfirm;
    confirmOverlay.classList.add("open");
  }
  function closeConfirm() {
    confirmOverlay.classList.remove("open");
    confirmCallback = null;
  }
  $("#confirmOkBtn").addEventListener("click", () => {
    const cb = confirmCallback;
    closeConfirm();
    if (cb) cb();
  });
  $("#confirmCancelBtn").addEventListener("click", closeConfirm);
  window.AppConfirm = showConfirm;
  confirmOverlay.addEventListener("click", e => { if (e.target === confirmOverlay) closeConfirm(); });

  let toastTimer;
  function showToast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }
  const scopeSwitch = $("#scopeSwitch");
  const monthInput = $("#monthInput");
  const allTimeToggle = $("#allTimeToggle");
  const tabs = document.querySelectorAll("#module-finance .tab-btn");
  const views = document.querySelectorAll("#module-finance .view");

  // ---------- Module switch (Finanzas / Hábitos) ----------
  const moduleSwitch = $("#moduleSwitch");
  const modules = document.querySelectorAll(".module");
  moduleSwitch.addEventListener("click", e => {
    const btn = e.target.closest(".module-btn");
    if (!btn) return;
    moduleSwitch.querySelectorAll(".module-btn").forEach(b => b.classList.toggle("active", b === btn));
    modules.forEach(m => m.classList.toggle("active", m.id === "module-" + btn.dataset.module));
    if (btn.dataset.module === "habits") renderHabitsActiveTab();
    if (btn.dataset.module === "office" && window.OfficeModule) window.OfficeModule.render();
  });

  monthInput.value = state.month;

  // ---------- Rendering: Dashboard ----------
  function renderDashboard() {
    const filtered = getFiltered(state);
    const income = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;

    $("#statCards").innerHTML = `
      <div class="stat-card income">
        <div class="label">Ingresos</div>
        <div class="value">${fmtMoney(income)}</div>
      </div>
      <div class="stat-card expense">
        <div class="label">Gastos</div>
        <div class="value">${fmtMoney(expense)}</div>
      </div>
      <div class="stat-card balance">
        <div class="label">Balance</div>
        <div class="value ${balance >= 0 ? "positive" : "negative"}">${fmtMoney(balance)}</div>
      </div>
    `;

    renderBarChart();
    renderDonutChart(filtered);
    renderPatrimonio();
    renderAssets();
    renderIncomeSplit();
  }

  function renderBarChart() {
    const months = lastNMonths(6);
    const data = months.map(m => {
      const rows = state.transactions.filter(t => scopeMatches(t.scope, state.scope) && monthOf(t.date) === m);
      return {
        month: m,
        income: rows.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: rows.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
      };
    });
    const max = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
    const W = 460, H = 200, padBottom = 26, padTop = 10;
    const groupW = W / data.length;
    const barW = Math.min(22, groupW / 3.2);

    let bars = "";
    data.forEach((d, i) => {
      const cx = i * groupW + groupW / 2;
      const incH = (d.income / max) * (H - padBottom - padTop);
      const expH = (d.expense / max) * (H - padBottom - padTop);
      const baseY = H - padBottom;
      bars += `<rect x="${cx - barW - 2}" y="${baseY - incH}" width="${barW}" height="${incH}" rx="3" fill="var(--income)"><title>Ingresos ${monthLabel(d.month)}: ${fmtMoney(d.income)}</title></rect>`;
      bars += `<rect x="${cx + 2}" y="${baseY - expH}" width="${barW}" height="${expH}" rx="3" fill="var(--expense)"><title>Gastos ${monthLabel(d.month)}: ${fmtMoney(d.expense)}</title></rect>`;
      bars += `<text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${monthLabel(d.month).replace(".", "")}</text>`;
    });

    $("#barChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="220">${bars}</svg>`;
  }

  function renderDonutChart(filtered) {
    const expenses = filtered.filter(t => t.type === "expense");
    const byCat = {};
    expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);

    const holder = $("#donutChart");
    const legend = $("#donutLegend");

    if (total === 0) {
      holder.innerHTML = `<div class="empty-state">Sin gastos en este periodo.</div>`;
      legend.innerHTML = "";
      return;
    }

    const R = 70, CX = 90, CY = 90, STROKE = 26;
    const circumference = 2 * Math.PI * R;
    let offsetAcc = 0;
    let circles = "";
    entries.forEach(([cat, val], i) => {
      const frac = val / total;
      const dash = frac * circumference;
      const color = PALETTE[i % PALETTE.length];
      circles += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${color}" stroke-width="${STROKE}"
        stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offsetAcc}" transform="rotate(-90 ${CX} ${CY})">
        <title>${cat}: ${fmtMoney(val)} (${(frac * 100).toFixed(1)}%)</title></circle>`;
      offsetAcc += dash;
    });

    holder.innerHTML = `<svg viewBox="0 0 180 180" width="200" height="200">${circles}
      <text x="90" y="86" text-anchor="middle" font-size="11" fill="var(--text-muted)">Total</text>
      <text x="90" y="104" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">${fmtMoney(total)}</text>
      </svg>`;

    legend.innerHTML = entries.slice(0, 8).map(([cat, val], i) => `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${PALETTE[i % PALETTE.length]}"></span>
        ${cat} — ${fmtMoney(val)}
      </div>`).join("");
  }

  function computePatrimonio() {
    const bucketByCat = {};
    state.categories.forEach(c => { if (c.bucket) bucketByCat[c.name] = c.bucket; });

    let personalIncome = 0, personalExpenseNonInv = 0, personalInversion = 0;
    let empresaIncome = 0, empresaExpense = 0;

    state.transactions.forEach(t => {
      if (t.scope === "personal") {
        if (t.type === "income") personalIncome += t.amount;
        else if (bucketByCat[t.category] === "inversion") personalInversion += t.amount;
        else personalExpenseNonInv += t.amount;
      } else if (t.scope === "empresa") {
        if (t.type === "income") empresaIncome += t.amount;
        else empresaExpense += t.amount;
      }
    });

    const assetSums = { ahorro: 0, inversion: 0, empresa: 0 };
    state.externalAssets.forEach(a => {
      if (assetSums.hasOwnProperty(a.bucket)) assetSums[a.bucket] += a.amount;
    });

    return {
      ahorro: personalIncome - personalExpenseNonInv + assetSums.ahorro,
      inversion: personalInversion + assetSums.inversion,
      empresa: empresaIncome - empresaExpense + assetSums.empresa,
    };
  }

  function renderPatrimonio() {
    const p = computePatrimonio();
    const segments = [
      { label: "Ahorro", value: p.ahorro, color: PALETTE[0] },
      { label: "Inversión", value: p.inversion, color: PALETTE[2] },
      { label: "Patrimonio empresa", value: p.empresa, color: PALETTE[3] },
    ];
    const total = segments.reduce((s, x) => s + x.value, 0);
    const positiveSum = segments.reduce((s, x) => s + Math.max(0, x.value), 0);

    const holder = $("#patrimonioChart");
    const legend = $("#patrimonioLegend");

    if (positiveSum <= 0) {
      holder.innerHTML = `<div class="empty-state">Aún no hay patrimonio positivo que mostrar.</div>`;
      legend.innerHTML = "";
      return;
    }

    const R = 70, CX = 90, CY = 90, STROKE = 26;
    const circumference = 2 * Math.PI * R;
    let offsetAcc = 0;
    let circles = "";
    segments.forEach(seg => {
      const val = Math.max(0, seg.value);
      if (val <= 0) return;
      const frac = val / positiveSum;
      const dash = frac * circumference;
      circles += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${seg.color}" stroke-width="${STROKE}"
        stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offsetAcc}" transform="rotate(-90 ${CX} ${CY})">
        <title>${seg.label}: ${fmtMoney(seg.value)}</title></circle>`;
      offsetAcc += dash;
    });

    holder.innerHTML = `<svg viewBox="0 0 180 180" width="200" height="200">${circles}
      <text x="90" y="86" text-anchor="middle" font-size="11" fill="var(--text-muted)">Patrimonio</text>
      <text x="90" y="104" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">${fmtMoney(total)}</text>
      </svg>`;

    legend.innerHTML = segments.map(seg => `
      <div class="legend-item">
        <span class="legend-swatch" style="background:${seg.color}"></span>
        ${seg.label} — ${fmtMoney(seg.value)}
      </div>`).join("");
  }

  // ---------- External assets (Patrimonio) ----------
  const ASSET_BUCKET_LABELS = { ahorro: "Ahorro", inversion: "Inversión", empresa: "Patrimonio empresa" };

  function renderAssets() {
    if (state.externalAssets.length === 0) {
      $("#assetsList").innerHTML = `<div class="empty-state">Sin activos externos definidos.</div>`;
      return;
    }
    $("#assetsList").innerHTML = state.externalAssets.map(a => `
      <div class="manage-row">
        <div class="habit-info">
          <div class="habit-name">${a.name} <span class="badge personal">${ASSET_BUCKET_LABELS[a.bucket]}</span></div>
          <div class="habit-meta">${fmtMoney(a.amount)}</div>
        </div>
        <span class="cat-item-actions">
          <button class="icon-btn edit-asset" data-id="${a.id}" title="Editar">✏️</button>
          <button class="icon-btn danger del-asset" data-id="${a.id}" title="Eliminar">✕</button>
        </span>
      </div>`).join("");

    document.querySelectorAll(".edit-asset").forEach(btn => btn.addEventListener("click", () => openAssetEdit(btn.dataset.id)));
    document.querySelectorAll(".del-asset").forEach(btn => btn.addEventListener("click", () => {
      const a = state.externalAssets.find(x => x.id === btn.dataset.id);
      if (!a) return;
      showConfirm(`¿Eliminar el activo "${a.name}"?`, () => {
        state.externalAssets = state.externalAssets.filter(x => x.id !== a.id);
        persistAssets();
        renderAssets();
        renderPatrimonio();
      });
    }));
  }

  function openAssetEdit(id) {
    const a = state.externalAssets.find(x => x.id === id);
    if (!a) return;
    $("#assetId").value = a.id;
    $("#assetName").value = a.name;
    $("#assetAmount").value = a.amount;
    $("#assetBucket").value = a.bucket;
    $("#assetFormTitle").textContent = `Editar activo "${a.name}"`;
    $("#assetSubmitBtn").textContent = "Guardar cambios";
    $("#assetCancelEditBtn").style.display = "";
    $("#assetName").focus();
    $("#assetForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetAssetForm() {
    $("#assetForm").reset();
    $("#assetId").value = "";
    $("#assetFormTitle").innerHTML = 'Activos externos <span class="scope-total">(no pasan por Movimientos)</span>';
    $("#assetSubmitBtn").textContent = "Agregar";
    $("#assetCancelEditBtn").style.display = "none";
  }

  $("#assetCancelEditBtn").addEventListener("click", resetAssetForm);

  $("#assetForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#assetName").value.trim();
    if (!name) return;
    const amount = parseFloat($("#assetAmount").value) || 0;
    const bucket = $("#assetBucket").value;
    const editId = $("#assetId").value;

    if (editId) {
      const a = state.externalAssets.find(x => x.id === editId);
      if (a) Object.assign(a, { name, amount, bucket });
      showToast("Activo actualizado.");
    } else {
      state.externalAssets.push({ id: uid(), name, amount, bucket });
    }
    persistAssets();
    resetAssetForm();
    renderAssets();
    renderPatrimonio();
  });

  function renderIncomeSplit() {
    const month = state.allTime ? currentMonthStr() : state.month;
    const personalTx = state.transactions.filter(t => t.scope === "personal" && (state.allTime || monthOf(t.date) === month));
    const income = personalTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);

    $("#incomeSplitSubtitle").textContent = income > 0 ? `— sobre ${fmtMoney(income)} de ingresos` : "";

    const catBucket = {};
    state.categories.forEach(c => { if (c.bucket) catBucket[c.name] = c.bucket; });

    const spendByBucket = { costes: 0, caprichos: 0, inversion: 0, donaciones: 0 };
    personalTx.filter(t => t.type === "expense").forEach(t => {
      const b = catBucket[t.category];
      if (b && spendByBucket.hasOwnProperty(b)) spendByBucket[b] += t.amount;
    });
    const spentTracked = spendByBucket.costes + spendByBucket.caprichos + spendByBucket.inversion + spendByBucket.donaciones;
    spendByBucket.ahorro = income - spentTracked;

    if (income <= 0) {
      $("#incomeSplitEditor").innerHTML = `<div class="hint" style="margin:0">Ajusta los porcentajes (deben sumar 100%):</div>`;
    }

    const order = ["ahorro", "inversion", "donaciones", "caprichos", "costes"];

    $("#incomeSplitEditor").innerHTML = order.map(b => `
      <label class="split-pct-field">
        <span>${BUCKET_LABELS[b]}</span>
        <input type="number" min="0" max="100" step="1" class="split-pct-input" data-bucket="${b}" value="${state.incomeSplit[b]}">%
      </label>`).join("");

    const pctSum = order.reduce((s, b) => s + (state.incomeSplit[b] || 0), 0);

    if (income <= 0) {
      $("#incomeSplitList").innerHTML = `<div class="empty-state">Registra un ingreso personal este mes para ver el reparto.</div>`;
    } else {
      $("#incomeSplitList").innerHTML = order.map(b => {
        const pct = state.incomeSplit[b] || 0;
        const target = income * pct / 100;
        const actual = spendByBucket[b];
        const isAccum = ACCUMULATION_BUCKETS.has(b);
        const pctOfTarget = target > 0 ? (actual / target) * 100 : 0;
        const barPct = Math.max(0, Math.min(100, pctOfTarget));
        let color;
        if (isAccum) {
          color = pctOfTarget >= 100 ? "var(--income)" : pctOfTarget >= 50 ? "var(--warn)" : "var(--expense)";
        } else {
          color = pctOfTarget >= 100 ? "var(--expense)" : pctOfTarget >= 80 ? "var(--warn)" : "var(--income)";
        }
        const statusText = isAccum
          ? (actual >= target ? "✓ objetivo cumplido" : `faltan ${fmtMoney(target - actual)}`)
          : (actual > target ? `${fmtMoney(actual - target)} por encima` : `${fmtMoney(target - actual)} de margen`);
        return `
          <div class="budget-row">
            <div class="budget-row-top">
              <span class="cat-name">${BUCKET_LABELS[b]} <span class="progress-caption">(${pct}%)</span></span>
              <span class="progress-caption">${fmtMoney(actual)} / ${fmtMoney(target)}</span>
            </div>
            <div class="progress-bar"><div class="progress-bar-fill" style="width:${barPct}%;background:${color}"></div></div>
            <div class="progress-caption">${statusText}</div>
          </div>`;
      }).join("");
    }

    document.querySelectorAll(".split-pct-input").forEach(inp => {
      inp.addEventListener("change", () => {
        const b = inp.dataset.bucket;
        state.incomeSplit[b] = parseFloat(inp.value) || 0;
        persistIncomeSplit();
        renderIncomeSplit();
      });
    });

    if (Math.round(pctSum) !== 100) {
      $("#incomeSplitSubtitle").textContent += ` · ⚠️ suman ${pctSum}%, no 100%`;
    }
  }

  // ---------- Rendering: Transactions ----------
  function populateCategoryFilter() {
    const sel = $("#txCategoryFilter");
    const current = sel.value;
    const cats = [...new Set(state.categories.filter(c => state.scope === "all" || c.scope === "ambos" || c.scope === state.scope).map(c => c.name))].sort();
    sel.innerHTML = `<option value="all">Todas las categorías</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join("");
    if (cats.includes(current)) sel.value = current;
  }

  function renderTransactions() {
    populateCategoryFilter();
    const search = $("#txSearch").value.trim().toLowerCase();
    const typeFilter = $("#txTypeFilter").value;
    const catFilter = $("#txCategoryFilter").value;

    let rows = getFiltered(state);
    if (typeFilter !== "all") rows = rows.filter(t => t.type === typeFilter);
    if (catFilter !== "all") rows = rows.filter(t => t.category === catFilter);
    if (search) rows = rows.filter(t => (t.description || "").toLowerCase().includes(search));
    rows = rows.slice().sort((a, b) => b.date.localeCompare(a.date));

    const tbody = $("#txTableBody");
    $("#txEmpty").style.display = rows.length ? "none" : "block";

    tbody.innerHTML = rows.map(t => `
      <tr>
        <td>${t.date}</td>
        <td>${t.type === "income" ? "Ingreso" : "Gasto"}</td>
        <td><span class="badge ${t.scope}">${t.scope === "personal" ? "Personal" : "Empresa"}</span></td>
        <td>${t.category}</td>
        <td>${t.description || ""}</td>
        <td class="num amount ${t.type}">${t.type === "income" ? "+" : "-"}${fmtMoney(t.amount)}</td>
        <td class="row-actions">
          <button data-edit="${t.id}" title="Editar">✏️</button>
          <button data-del="${t.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openTxModal(btn.dataset.edit)));
    tbody.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", () => {
      showConfirm("¿Eliminar este movimiento?", () => {
        state.transactions = state.transactions.filter(t => t.id !== btn.dataset.del);
        persistTx();
        renderAll();
      });
    }));
  }

  // ---------- Rendering: Fixed (recurring) expenses ----------
  function isAppliedForMonth(rec, month) {
    return state.transactions.some(t => t.recurringId === rec.id && monthOf(t.date) === month);
  }

  function applyRecurring(rec, month) {
    state.transactions.push({
      id: uid(),
      type: "expense",
      scope: rec.scope,
      date: month + "-01",
      category: rec.category,
      amount: rec.amount,
      description: rec.name,
      recurringId: rec.id,
    });
    persistTx();
  }

  function unapplyRecurring(rec, month) {
    state.transactions = state.transactions.filter(t => !(t.recurringId === rec.id && monthOf(t.date) === month));
    persistTx();
  }

  function populateFixedCategorySelect() {
    const scope = $("#fixedScope").value;
    const sel = $("#fixedCategory");
    const current = sel.value;
    const cats = categoriesFor("expense", scope);
    sel.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }

  function renderFixed() {
    populateFixedCategorySelect();
    const month = state.allTime ? currentMonthStr() : state.month;
    const scopesToShow = ["personal", "empresa"];

    $("#fixedList").innerHTML = scopesToShow.map(scope => {
      const items = state.recurring.filter(r => r.scope === scope);
      const total = items.reduce((s, r) => s + r.amount, 0);
      const rows = items.map(r => {
        const applied = isAppliedForMonth(r, month);
        return `
          <div class="budget-row">
            <div class="budget-row-top">
              <span class="cat-name">${r.name} <span class="progress-caption">(${r.category})</span></span>
              <span class="progress-caption">${fmtMoney(r.amount)}</span>
            </div>
            <div class="fixed-row-actions">
              <button class="toggle-applied ${applied ? "applied" : ""}" data-toggle="${r.id}" data-applied="${applied}">
                ${applied ? "✓ Registrado en " + monthLabel(month) : "Registrar en " + monthLabel(month)}
              </button>
              <span class="cat-item-actions">
                <button class="icon-btn edit-fixed" data-id="${r.id}" title="Editar">✏️</button>
                <button class="icon-btn danger del-fixed" data-id="${r.id}" title="Eliminar">✕</button>
              </span>
            </div>
          </div>`;
      }).join("");

      return `<div class="card">
        <h3>${scope === "personal" ? "Personal" : "Empresa"} <span class="scope-total">— total mensual: ${fmtMoney(total)}</span></h3>
        ${items.length ? `<button type="button" class="secondary-btn apply-all-btn" data-apply-all="${scope}">Registrar todos los pendientes de ${monthLabel(month)}</button>` : ""}
        ${rows || '<div class="empty-state">Sin gastos fijos definidos.</div>'}
      </div>`;
    }).join("");

    document.querySelectorAll("[data-toggle]").forEach(btn => btn.addEventListener("click", () => {
      const rec = state.recurring.find(r => r.id === btn.dataset.toggle);
      if (!rec) return;
      if (btn.dataset.applied === "true") unapplyRecurring(rec, month);
      else applyRecurring(rec, month);
      renderFixed();
    }));

    document.querySelectorAll("[data-apply-all]").forEach(btn => btn.addEventListener("click", () => {
      const scope = btn.dataset.applyAll;
      state.recurring.filter(r => r.scope === scope).forEach(r => {
        if (!isAppliedForMonth(r, month)) applyRecurring(r, month);
      });
      renderFixed();
    }));

    document.querySelectorAll(".edit-fixed").forEach(btn => btn.addEventListener("click", () => openFixedEdit(btn.dataset.id)));

    document.querySelectorAll(".del-fixed").forEach(btn => btn.addEventListener("click", () => {
      const rec = state.recurring.find(r => r.id === btn.dataset.id);
      if (!rec) return;
      showConfirm(`¿Eliminar el gasto fijo "${rec.name}"? Los movimientos ya generados no se borrarán.`, () => {
        state.recurring = state.recurring.filter(r => r.id !== rec.id);
        persistRecurring();
        renderFixed();
      });
    }));
  }

  function openFixedEdit(id) {
    const rec = state.recurring.find(r => r.id === id);
    if (!rec) return;
    $("#fixedId").value = rec.id;
    $("#fixedName").value = rec.name;
    $("#fixedScope").value = rec.scope;
    populateFixedCategorySelect();
    $("#fixedCategory").value = rec.category;
    $("#fixedAmount").value = rec.amount;
    $("#fixedFormTitle").textContent = `Editar gasto fijo "${rec.name}"`;
    $("#fixedSubmitBtn").textContent = "Guardar cambios";
    $("#fixedCancelEditBtn").style.display = "";
    $("#fixedName").focus();
    $("#fixedForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetFixedForm() {
    $("#fixedForm").reset();
    $("#fixedId").value = "";
    $("#fixedFormTitle").textContent = "Nuevo gasto fijo";
    $("#fixedSubmitBtn").textContent = "Agregar";
    $("#fixedCancelEditBtn").style.display = "none";
    populateFixedCategorySelect();
  }

  $("#fixedScope").addEventListener("change", populateFixedCategorySelect);
  $("#fixedCancelEditBtn").addEventListener("click", resetFixedForm);

  $("#fixedForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#fixedName").value.trim();
    if (!name) return;
    const scope = $("#fixedScope").value;
    const category = $("#fixedCategory").value;
    const amount = parseFloat($("#fixedAmount").value) || 0;
    const editId = $("#fixedId").value;

    if (editId) {
      const rec = state.recurring.find(r => r.id === editId);
      if (rec) Object.assign(rec, { name, scope, category, amount });
      showToast("Gasto fijo actualizado.");
    } else {
      state.recurring.push({ id: uid(), name, scope, category, amount });
    }
    persistRecurring();
    resetFixedForm();
    renderFixed();
  });

  // ---------- Rendering: Categories ----------
  function renderCategories() {
    const groups = [
      { key: "personal-income", label: "Personal · Ingresos", type: "income", scope: "personal" },
      { key: "personal-expense", label: "Personal · Gastos", type: "expense", scope: "personal" },
      { key: "empresa-income", label: "Empresa · Ingresos", type: "income", scope: "empresa" },
      { key: "empresa-expense", label: "Empresa · Gastos", type: "expense", scope: "empresa" },
    ];
    $("#categoriesList").innerHTML = groups.map(g => {
      const items = state.categories.filter(c => c.type === g.type && (c.scope === g.scope || c.scope === "ambos"));
      const rows = items.map(c => `
        <div class="category-item">
          <span>${c.name} ${c.scope === "ambos" ? '<span class="badge personal">ambos</span>' : ""} ${c.bucket ? `<span class="badge empresa">${BUCKET_LABELS[c.bucket]}</span>` : ""}</span>
          <span class="cat-item-actions">
            <button class="icon-btn edit-cat" data-id="${c.id}" title="Editar">✏️</button>
            <button class="icon-btn danger del-cat" data-id="${c.id}" title="Eliminar">✕</button>
          </span>
        </div>`).join("");
      return `<div class="card"><h3>${g.label}</h3>${rows || '<div class="empty-state">Sin categorías.</div>'}</div>`;
    }).join("");

    document.querySelectorAll(".edit-cat").forEach(btn => btn.addEventListener("click", () => openCategoryEdit(btn.dataset.id)));

    document.querySelectorAll(".del-cat").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const cat = state.categories.find(c => c.id === id);
      const inUse = state.transactions.some(t => t.category === cat.name) || state.recurring.some(r => r.category === cat.name);
      if (inUse) {
        showToast(`No se puede eliminar "${cat.name}" porque tiene movimientos o gastos fijos asociados.`);
        return;
      }
      showConfirm(`¿Eliminar la categoría "${cat.name}"?`, () => {
        state.categories = state.categories.filter(c => c.id !== id);
        persistCat();
        renderCategories();
      });
    }));
  }

  function categoryInUse(cat) {
    return state.transactions.some(t => t.category === cat.name && (cat.scope === "ambos" || t.scope === cat.scope))
      || state.recurring.some(r => r.category === cat.name && (cat.scope === "ambos" || r.scope === cat.scope));
  }

  function openCategoryEdit(id) {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    $("#catId").value = cat.id;
    $("#catName").value = cat.name;
    $("#catType").value = cat.type;
    $("#catScope").value = cat.scope;
    $("#catBucket").value = cat.bucket || "";
    updateCatBucketVisibility();
    $("#categoryFormTitle").textContent = `Editar categoría "${cat.name}"`;
    $("#catSubmitBtn").textContent = "Guardar cambios";
    $("#catCancelEditBtn").style.display = "";

    const locked = categoryInUse(cat);
    $("#catType").disabled = locked;
    $("#catScope").disabled = locked;
    const hint = $("#catEditHint");
    if (locked) {
      hint.textContent = "Esta categoría ya tiene movimientos o gastos fijos asociados: solo puedes renombrarla, no cambiar su tipo o ámbito.";
      hint.style.display = "";
    } else {
      hint.style.display = "none";
    }
    $("#catName").focus();
    $("#categoryForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetCategoryForm() {
    $("#categoryForm").reset();
    $("#catId").value = "";
    $("#categoryFormTitle").textContent = "Nueva categoría";
    $("#catSubmitBtn").textContent = "Agregar";
    $("#catCancelEditBtn").style.display = "none";
    $("#catType").disabled = false;
    $("#catScope").disabled = false;
    $("#catEditHint").style.display = "none";
    updateCatBucketVisibility();
  }

  function updateCatBucketVisibility() {
    const isExpense = $("#catType").value === "expense";
    $("#catBucket").style.display = isExpense ? "" : "none";
    if (!isExpense) $("#catBucket").value = "";
  }
  $("#catType").addEventListener("change", updateCatBucketVisibility);

  $("#catCancelEditBtn").addEventListener("click", resetCategoryForm);

  // ---------- Transaction Modal ----------
  const txModalOverlay = $("#txModalOverlay");
  const txForm = $("#txForm");

  function populateTxCategorySelect() {
    const type = txForm.querySelector('input[name="txType"]:checked').value;
    const scope = txForm.querySelector('input[name="txScope"]:checked').value;
    const sel = $("#txCategory");
    const current = sel.value;
    const cats = categoriesFor(type, scope);
    sel.innerHTML = cats.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }

  function openTxModal(editId) {
    state.editingTxId = editId || null;
    txForm.reset();
    if (editId) {
      const t = state.transactions.find(x => x.id === editId);
      $("#txModalTitle").textContent = "Editar movimiento";
      txForm.querySelector(`input[name="txType"][value="${t.type}"]`).checked = true;
      txForm.querySelector(`input[name="txScope"][value="${t.scope}"]`).checked = true;
      $("#txDate").value = t.date;
      $("#txAmount").value = t.amount;
      $("#txDescription").value = t.description || "";
      populateTxCategorySelect();
      $("#txCategory").value = t.category;
    } else {
      $("#txModalTitle").textContent = "Nuevo movimiento";
      $("#txDate").value = new Date().toISOString().slice(0, 10);
      if (state.scope !== "all") {
        txForm.querySelector(`input[name="txScope"][value="${state.scope}"]`).checked = true;
      }
      populateTxCategorySelect();
    }
    txModalOverlay.classList.add("open");
  }
  function closeTxModal() {
    txModalOverlay.classList.remove("open");
    state.editingTxId = null;
  }

  txForm.querySelectorAll('input[name="txType"], input[name="txScope"]').forEach(el =>
    el.addEventListener("change", populateTxCategorySelect)
  );

  txForm.addEventListener("submit", e => {
    e.preventDefault();
    const type = txForm.querySelector('input[name="txType"]:checked').value;
    const scope = txForm.querySelector('input[name="txScope"]:checked').value;
    const payload = {
      type, scope,
      date: $("#txDate").value,
      category: $("#txCategory").value,
      amount: parseFloat($("#txAmount").value) || 0,
      description: $("#txDescription").value.trim(),
    };
    if (state.editingTxId) {
      const t = state.transactions.find(x => x.id === state.editingTxId);
      Object.assign(t, payload);
    } else {
      state.transactions.push({ id: uid(), ...payload });
    }
    persistTx();
    closeTxModal();
    renderAll();
  });

  $("#addTxBtn").addEventListener("click", () => openTxModal(null));
  $("#txCancelBtn").addEventListener("click", closeTxModal);
  txModalOverlay.addEventListener("click", e => { if (e.target === txModalOverlay) closeTxModal(); });

  // ---------- Category form ----------
  $("#categoryForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#catName").value.trim();
    if (!name) return;
    const type = $("#catType").value;
    const scope = $("#catScope").value;
    const bucket = type === "expense" ? ($("#catBucket").value || null) : null;
    const editId = $("#catId").value;

    const dup = state.categories.some(c =>
      c.name.toLowerCase() === name.toLowerCase() && c.type === type && c.scope === scope && c.id !== editId
    );
    if (dup) { showToast("Esa categoría ya existe."); return; }

    if (editId) {
      const cat = state.categories.find(c => c.id === editId);
      if (!cat) { resetCategoryForm(); return; }
      const oldName = cat.name, oldScope = cat.scope;
      const locked = categoryInUse(cat);

      if (oldName !== name) {
        state.transactions.forEach(t => {
          if (t.category === oldName && (oldScope === "ambos" || t.scope === oldScope)) t.category = name;
        });
        state.recurring.forEach(r => {
          if (r.category === oldName && (oldScope === "ambos" || r.scope === oldScope)) r.category = name;
        });
        persistTx();
        persistRecurring();
      }
      cat.name = name;
      cat.bucket = bucket;
      if (!locked) {
        cat.type = type;
        cat.scope = scope;
      }
      persistCat();
      resetCategoryForm();
      renderCategories();
      showToast("Categoría actualizada.");
      return;
    }

    state.categories.push({ id: uid(), name, type, scope, bucket });
    persistCat();
    resetCategoryForm();
    renderCategories();
  });

  // ---------- Top filters ----------
  scopeSwitch.addEventListener("click", e => {
    const btn = e.target.closest(".scope-btn");
    if (!btn) return;
    state.scope = btn.dataset.scope;
    scopeSwitch.querySelectorAll(".scope-btn").forEach(b => b.classList.toggle("active", b === btn));
    renderAll();
  });

  monthInput.addEventListener("change", () => {
    state.month = monthInput.value;
    renderAll();
  });

  allTimeToggle.addEventListener("change", () => {
    state.allTime = allTimeToggle.checked;
    monthInput.disabled = state.allTime;
    renderAll();
  });

  ["txSearch", "txTypeFilter", "txCategoryFilter"].forEach(id => {
    $("#" + id).addEventListener("input", renderTransactions);
    $("#" + id).addEventListener("change", renderTransactions);
  });

  // ---------- Tabs ----------
  tabs.forEach(btn => btn.addEventListener("click", () => {
    tabs.forEach(b => b.classList.toggle("active", b === btn));
    state.activeTab = btn.dataset.tab;
    views.forEach(v => v.classList.toggle("active", v.id === "view-" + btn.dataset.tab));
    renderActiveTab();
  }));

  function renderActiveTab() {
    if (state.activeTab === "dashboard") renderDashboard();
    else if (state.activeTab === "transactions") renderTransactions();
    else if (state.activeTab === "fixed") renderFixed();
    else if (state.activeTab === "categories") renderCategories();
  }

  function renderAll() { renderActiveTab(); }

  // ---------- Habits: Tabs ----------
  const habitsTabs = document.querySelectorAll("#module-habits .tab-btn");
  const habitsViews = document.querySelectorAll("#module-habits .view");

  habitsTabs.forEach(btn => btn.addEventListener("click", () => {
    habitsTabs.forEach(b => b.classList.toggle("active", b === btn));
    habitsState.activeTab = btn.dataset.habitsTab;
    habitsViews.forEach(v => v.classList.toggle("active", v.id === "habits-view-" + btn.dataset.habitsTab));
    renderHabitsActiveTab();
  }));

  function renderHabitsActiveTab() {
    updatePointsHud();
    if (habitsState.activeTab === "today") renderHabitsToday();
    else if (habitsState.activeTab === "week") renderHabitsWeek();
    else if (habitsState.activeTab === "manage") renderHabitsManage();
    else if (habitsState.activeTab === "rewards") renderRewards();
  }

  function updatePointsHud() {
    $("#pointsBalance").textContent = pointsBalance();
  }

  // ---------- Habits: Today ----------
  const weekdayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });

  function renderHabitsToday() {
    const today = todayStr();
    $("#todayDateLabel").textContent = weekdayFmt.format(new Date());

    const goal = habitsState.weeklyGoal || 0;
    const ws = weekStartStr(new Date());
    const earnedThisWeek = pointsForWeek(ws);
    const pct = goal > 0 ? Math.min(100, (earnedThisWeek / goal) * 100) : 0;
    const color = pct >= 100 ? "var(--income)" : pct >= 50 ? "var(--accent)" : "var(--warn)";
    $("#weeklyProgressFill").style.width = pct + "%";
    $("#weeklyProgressFill").style.background = color;
    $("#weeklyProgressCaption").textContent = `${earnedThisWeek} / ${goal} pts esta semana`;
    if (document.activeElement !== $("#weeklyGoalInput")) $("#weeklyGoalInput").value = goal;

    if (habitsState.habits.length === 0) {
      $("#todayList").innerHTML = `<div class="empty-state">Aún no tienes hábitos. Ve a la pestaña "Hábitos" para crear el primero.</div>`;
      $("#todayBonusCard").style.display = "none";
      return;
    }

    function habitRow(h) {
      const done = habitCompletedOn(h.id, today);
      const streak = streakFor(h.id);
      return `
        <div class="habit-row">
          <button class="habit-check ${done ? "done" : ""}" data-toggle-habit="${h.id}">${done ? "✓" : ""}</button>
          <div class="habit-info">
            <div class="habit-name">${h.name}</div>
            <div class="habit-meta">${streak > 0 ? "🔥 " + streak + " día" + (streak === 1 ? "" : "s") + " seguidos" : "Sin racha activa"}</div>
          </div>
          <span class="habit-points-badge">+${h.points} pts</span>
        </div>`;
    }

    const core = habitsState.habits.filter(h => !h.bonus);
    const bonus = habitsState.habits.filter(h => h.bonus);

    $("#todayList").innerHTML = core.length
      ? core.map(habitRow).join("")
      : `<div class="empty-state">Todos tus hábitos son bonus. Ve a la pestaña "Hábitos" para marcar alguno como básico.</div>`;

    if (bonus.length) {
      $("#todayBonusCard").style.display = "";
      $("#todayBonusList").innerHTML = bonus.map(habitRow).join("");
    } else {
      $("#todayBonusCard").style.display = "none";
    }

    document.querySelectorAll("[data-toggle-habit]").forEach(btn => btn.addEventListener("click", () => {
      toggleCompletion(btn.dataset.toggleHabit, today);
      renderHabitsToday();
      updatePointsHud();
    }));
  }

  $("#weeklyGoalInput").addEventListener("change", () => {
    habitsState.weeklyGoal = parseFloat($("#weeklyGoalInput").value) || 0;
    persistWeeklyGoal();
    renderHabitsToday();
  });

  // ---------- Habits: Week ----------
  const dayHeaderFmt = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric" });
  const rangeFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });

  function weekDates(weekStart) {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return isoDate(d);
    });
  }

  function renderHabitsWeek() {
    const dates = weekDates(habitsState.weekViewStart);
    const today = todayStr();
    const endLabel = new Date(dates[6]);
    $("#weekRangeLabel").textContent = `${rangeFmt.format(new Date(dates[0]))} – ${rangeFmt.format(endLabel)}`;

    const thead = document.querySelector("#weekTable thead");
    const tbody = document.querySelector("#weekTable tbody");
    const tfoot = document.querySelector("#weekTable tfoot");

    thead.innerHTML = `<tr>
      <th>Hábito</th>
      ${dates.map(d => `<th>${dayHeaderFmt.format(new Date(d))}</th>`).join("")}
      <th>Total</th>
    </tr>`;

    if (habitsState.habits.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Aún no tienes hábitos.</div></td></tr>`;
      tfoot.innerHTML = "";
      return;
    }

    tbody.innerHTML = habitsState.habits.map(h => {
      const weekCount = dates.filter(d => habitCompletedOn(h.id, d)).length;
      const cells = dates.map(d => {
        const done = habitCompletedOn(h.id, d);
        return `<td><button class="week-check ${done ? "done" : ""} ${d === today ? "today" : ""}" data-week-toggle="${h.id}" data-week-date="${d}">${done ? "✓" : ""}</button></td>`;
      }).join("");
      return `<tr><td>${h.name}${h.bonus ? ' <span class="badge personal">bonus</span>' : ""}</td>${cells}<td>${weekCount * h.points} pts</td></tr>`;
    }).join("");

    const dayTotals = dates.map(d =>
      habitsState.habits.reduce((sum, h) => sum + (habitCompletedOn(h.id, d) ? h.points : 0), 0)
    );
    const weekTotal = dayTotals.reduce((s, v) => s + v, 0);
    tfoot.innerHTML = `<tr><td>Total del día</td>${dayTotals.map(t => `<td>${t}</td>`).join("")}<td>${weekTotal} pts</td></tr>`;

    document.querySelectorAll("[data-week-toggle]").forEach(btn => btn.addEventListener("click", () => {
      toggleCompletion(btn.dataset.weekToggle, btn.dataset.weekDate);
      renderHabitsWeek();
      updatePointsHud();
    }));
  }

  $("#weekPrevBtn").addEventListener("click", () => {
    const d = new Date(habitsState.weekViewStart);
    d.setDate(d.getDate() - 7);
    habitsState.weekViewStart = isoDate(d);
    renderHabitsWeek();
  });
  $("#weekNextBtn").addEventListener("click", () => {
    const d = new Date(habitsState.weekViewStart);
    d.setDate(d.getDate() + 7);
    habitsState.weekViewStart = isoDate(d);
    renderHabitsWeek();
  });
  $("#weekTodayBtn").addEventListener("click", () => {
    habitsState.weekViewStart = weekStartStr(new Date());
    renderHabitsWeek();
  });

  // ---------- Habits: Manage ----------
  function renderHabitsManage() {
    if (habitsState.habits.length === 0) {
      $("#habitsList").innerHTML = `<div class="empty-state">Sin hábitos definidos.</div>`;
      return;
    }
    $("#habitsList").innerHTML = habitsState.habits.map(h => {
      const streak = streakFor(h.id);
      const timesDone = habitsState.completions.filter(c => c.habitId === h.id).length;
      return `
        <div class="manage-row">
          <div class="habit-info">
            <div class="habit-name">${h.name} ${h.bonus ? '<span class="badge personal">bonus</span>' : ""}</div>
            <div class="habit-meta">${h.points} pts · ${timesDone} veces completado · racha actual: ${streak}</div>
          </div>
          <span class="cat-item-actions">
            <button class="icon-btn edit-habit" data-id="${h.id}" title="Editar">✏️</button>
            <button class="icon-btn danger del-habit" data-id="${h.id}" title="Eliminar">✕</button>
          </span>
        </div>`;
    }).join("");

    document.querySelectorAll(".edit-habit").forEach(btn => btn.addEventListener("click", () => openHabitEdit(btn.dataset.id)));
    document.querySelectorAll(".del-habit").forEach(btn => btn.addEventListener("click", () => {
      const h = habitsState.habits.find(x => x.id === btn.dataset.id);
      if (!h) return;
      showConfirm(`¿Eliminar el hábito "${h.name}"? Se perderá su historial de días completados.`, () => {
        habitsState.habits = habitsState.habits.filter(x => x.id !== h.id);
        habitsState.completions = habitsState.completions.filter(c => c.habitId !== h.id);
        persistHabits();
        persistCompletions();
        renderHabitsManage();
        updatePointsHud();
      });
    }));
  }

  function openHabitEdit(id) {
    const h = habitsState.habits.find(x => x.id === id);
    if (!h) return;
    habitsState.editingHabitId = h.id;
    $("#habitId").value = h.id;
    $("#habitName").value = h.name;
    $("#habitPoints").value = h.points;
    $("#habitBonus").checked = !!h.bonus;
    $("#habitFormTitle").textContent = `Editar hábito "${h.name}"`;
    $("#habitSubmitBtn").textContent = "Guardar cambios";
    $("#habitCancelEditBtn").style.display = "";
    $("#habitName").focus();
    $("#habitForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetHabitForm() {
    $("#habitForm").reset();
    $("#habitId").value = "";
    habitsState.editingHabitId = null;
    $("#habitFormTitle").textContent = "Nuevo hábito";
    $("#habitSubmitBtn").textContent = "Agregar";
    $("#habitCancelEditBtn").style.display = "none";
  }

  $("#habitCancelEditBtn").addEventListener("click", resetHabitForm);

  $("#habitForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#habitName").value.trim();
    if (!name) return;
    const points = parseFloat($("#habitPoints").value) || 0;
    const bonus = $("#habitBonus").checked;
    const editId = $("#habitId").value;

    if (editId) {
      const h = habitsState.habits.find(x => x.id === editId);
      if (h) Object.assign(h, { name, points, bonus });
      showToast("Hábito actualizado.");
    } else {
      habitsState.habits.push({ id: uid(), name, points, bonus });
    }
    persistHabits();
    resetHabitForm();
    renderHabitsManage();
    if (habitsState.activeTab === "today") renderHabitsToday();
  });

  // ---------- Habits: Rewards ----------
  function renderRewards() {
    const balance = pointsBalance();

    if (habitsState.rewards.length === 0) {
      $("#rewardsList").innerHTML = `<div class="empty-state">Sin recompensas definidas.</div>`;
    } else {
      $("#rewardsList").innerHTML = habitsState.rewards.map(r => `
        <div class="reward-row">
          <div class="habit-info">
            <div class="habit-name">${r.name}</div>
            <div class="habit-meta">${r.cost} pts</div>
          </div>
          <button class="redeem-btn" data-redeem="${r.id}" ${balance < r.cost ? "disabled" : ""}>Canjear</button>
          <span class="cat-item-actions">
            <button class="icon-btn edit-reward" data-id="${r.id}" title="Editar">✏️</button>
            <button class="icon-btn danger del-reward" data-id="${r.id}" title="Eliminar">✕</button>
          </span>
        </div>`).join("");
    }

    const sortedRedemptions = habitsState.redemptions.slice().sort((a, b) => b.date.localeCompare(a.date));
    $("#redemptionsList").innerHTML = sortedRedemptions.length
      ? sortedRedemptions.map(r => `
          <div class="redemption-item">
            <span>${r.name}</span>
            <span>${r.date} · -${r.cost} pts</span>
          </div>`).join("")
      : `<div class="empty-state">Aún no has canjeado ninguna recompensa.</div>`;

    document.querySelectorAll("[data-redeem]").forEach(btn => btn.addEventListener("click", () => {
      const r = habitsState.rewards.find(x => x.id === btn.dataset.redeem);
      if (!r || pointsBalance() < r.cost) return;
      showConfirm(`¿Canjear "${r.name}" por ${r.cost} pts?`, () => {
        habitsState.redemptions.push({ id: uid(), rewardId: r.id, name: r.name, cost: r.cost, date: todayStr() });
        persistRedemptions();
        renderRewards();
        updatePointsHud();
        showToast(`¡Canjeaste "${r.name}"!`);
      }, "Canjear");
    }));

    document.querySelectorAll(".edit-reward").forEach(btn => btn.addEventListener("click", () => openRewardEdit(btn.dataset.id)));
    document.querySelectorAll(".del-reward").forEach(btn => btn.addEventListener("click", () => {
      const r = habitsState.rewards.find(x => x.id === btn.dataset.id);
      if (!r) return;
      showConfirm(`¿Eliminar la recompensa "${r.name}"?`, () => {
        habitsState.rewards = habitsState.rewards.filter(x => x.id !== r.id);
        persistRewards();
        renderRewards();
      });
    }));
  }

  function openRewardEdit(id) {
    const r = habitsState.rewards.find(x => x.id === id);
    if (!r) return;
    habitsState.editingRewardId = r.id;
    $("#rewardId").value = r.id;
    $("#rewardName").value = r.name;
    $("#rewardCost").value = r.cost;
    $("#rewardFormTitle").textContent = `Editar recompensa "${r.name}"`;
    $("#rewardSubmitBtn").textContent = "Guardar cambios";
    $("#rewardCancelEditBtn").style.display = "";
    $("#rewardName").focus();
    $("#rewardForm").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function resetRewardForm() {
    $("#rewardForm").reset();
    $("#rewardId").value = "";
    habitsState.editingRewardId = null;
    $("#rewardFormTitle").textContent = "Nueva recompensa";
    $("#rewardSubmitBtn").textContent = "Agregar";
    $("#rewardCancelEditBtn").style.display = "none";
  }

  $("#rewardCancelEditBtn").addEventListener("click", resetRewardForm);

  $("#rewardForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#rewardName").value.trim();
    if (!name) return;
    const cost = parseFloat($("#rewardCost").value) || 0;
    const editId = $("#rewardId").value;

    if (editId) {
      const r = habitsState.rewards.find(x => x.id === editId);
      if (r) Object.assign(r, { name, cost });
      showToast("Recompensa actualizada.");
    } else {
      habitsState.rewards.push({ id: uid(), name, cost });
    }
    persistRewards();
    resetRewardForm();
    renderRewards();
  });

  // ---------- Export / Import ----------
  $("#exportBtn").addEventListener("click", () => {
    const data = {
      transactions: state.transactions, categories: state.categories, recurring: state.recurring,
      incomeSplit: state.incomeSplit, externalAssets: state.externalAssets,
      habits: habitsState.habits, completions: habitsState.completions, rewards: habitsState.rewards,
      redemptions: habitsState.redemptions, weeklyGoal: habitsState.weeklyGoal,
      office: window.OfficeModule ? window.OfficeModule.getData() : undefined,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanzas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $("#importInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        showToast("El archivo no es un backup válido.");
        return;
      }
      showConfirm("Esto reemplazará todos tus datos actuales con los del archivo importado. ¿Continuar?", () => {
        state.transactions = data.transactions || [];
        state.categories = data.categories || DEFAULT_CATEGORIES;
        state.recurring = data.recurring || [];
        state.incomeSplit = data.incomeSplit || DEFAULT_INCOME_SPLIT;
        state.externalAssets = data.externalAssets || [];
        persistTx(); persistCat(); persistRecurring(); persistIncomeSplit(); persistAssets();

        habitsState.habits = data.habits || [];
        habitsState.completions = data.completions || [];
        habitsState.rewards = data.rewards || [];
        habitsState.redemptions = data.redemptions || [];
        habitsState.weeklyGoal = data.weeklyGoal || 0;
        persistHabits(); persistCompletions(); persistRewards(); persistRedemptions(); persistWeeklyGoal();

        if (data.office && window.OfficeModule) window.OfficeModule.setData(data.office);

        renderAll();
        renderHabitsActiveTab();
        showToast("Datos importados correctamente.");
      }, "Importar");
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  // ---------- Init ----------
  updateCatBucketVisibility();
  renderAll();
})();
