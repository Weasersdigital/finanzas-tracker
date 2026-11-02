// ---------- Oficina virtual ----------
// Módulo independiente: departamentos con personas trabajando, sala de reuniones,
// cafetería, simulación en vivo y gestión del equipo. Persiste en localStorage.
(function () {
  "use strict";

  const KEY = "ft_office";
  const $ = sel => document.querySelector(sel);

  const STATUS = {
    working: { label: "Trabajando", icon: "💻", color: "#16a34a" },
    meeting: { label: "En reunión", icon: "🗣️", color: "#7c3aed" },
    break:   { label: "En pausa",   icon: "☕", color: "#d97706" },
    away:    { label: "Ausente",    icon: "🌙", color: "#9ca3af" },
  };

  const SKINS = ["#f5d0b5", "#e8b896", "#d29b72", "#a86e47", "#7a4a2a", "#f1c9a5"];
  const HAIRS = ["#2b1d14", "#5a3a22", "#a0522d", "#d4a24c", "#1c1c1c", "#8b8b8b", "#c0392b"];
  const HAIR_STYLES = { short: "Corto", long: "Largo", bun: "Moño", curly: "Rizado", bald: "Calvo" };

  const PHRASES = {
    default: ["Un momento…", "¡Listo! ✅", "Revisando correos 📧", "Casi termino", "¿Alguien tiene un cargador?"],
    "Dirección": ["Revisando objetivos Q4 📈", "Firmando contratos ✍️", "¡Buen trabajo, equipo!", "Preparando la estrategia"],
    "Finanzas": ["Cuadrando el balance 💰", "Facturas al día ✅", "Revisando el flujo de caja", "Cerrando el mes 📊"],
    "Marketing": ["Lanzando campaña 🚀", "¿Este color o este? 🎨", "Programando posts 📱", "El reel va genial 🔥"],
    "Ventas": ["¡Cerré una venta! 🎉", "Llamando a un cliente 📞", "Enviando propuesta", "Seguimiento del lead"],
    "Tecnología": ["Desplegando a producción 🚢", "Arreglando un bug 🐛", "git push ✨", "Funciona en mi máquina 😅"],
    "RR.HH.": ["Entrevista a las 12 🤝", "Organizando la formación", "Revisando nóminas", "¡Bienvenida, nueva incorporación!"],
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const DESK_ITEMS = ["🪴", "📚", "🖊️", "☕", "📎", "🌵", "🧸", "🎧"];
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function defaultData() {
    const d = [
      { id: uid(), name: "Dirección",  emoji: "👔", color: "#4f46e5" },
      { id: uid(), name: "Finanzas",   emoji: "💰", color: "#16a34a" },
      { id: uid(), name: "Marketing",  emoji: "📣", color: "#db2777" },
      { id: uid(), name: "Ventas",     emoji: "🤝", color: "#ea580c" },
      { id: uid(), name: "Tecnología", emoji: "💻", color: "#0891b2" },
      { id: uid(), name: "RR.HH.",     emoji: "🧑‍🤝‍🧑", color: "#9333ea" },
    ];
    const people = [
      ["Arturo", "CEO", 0, "short"], ["Laura", "Directora de operaciones", 0, "long"],
      ["Carlos", "Contable", 1, "short"], ["Marta", "Analista financiera", 1, "bun"],
      ["Sofía", "Community manager", 2, "long"], ["Diego", "Diseñador gráfico", 2, "curly"], ["Valeria", "Editora de vídeo", 2, "bun"],
      ["Javier", "Comercial", 3, "bald"], ["Lucía", "Account manager", 3, "long"],
      ["Pablo", "Desarrollador", 4, "curly"], ["Elena", "Desarrolladora", 4, "short"], ["Hugo", "DevOps", 4, "short"],
      ["Andrea", "Responsable de personas", 5, "curly"],
    ].map(([name, role, di, hairStyle], i) => ({
      id: uid(), name, role, deptId: d[di].id, hairStyle,
      skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 3) % HAIRS.length],
      shirt: d[di].color, status: i % 6 === 5 ? "break" : "working",
    }));
    return { departments: d, people, simulate: true };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.error("Error leyendo oficina", e); }
    return null;
  }
  let data = load() || defaultData();
  function persist() { localStorage.setItem(KEY, JSON.stringify(data)); }
  persist();

  const deptById = id => data.departments.find(d => d.id === id);

  // ---------- Avatar ----------
  function avatarHTML(p, extra = "") {
    return `<div class="av ${extra} hair-${esc(p.hairStyle || "short")}" style="--skin:${esc(p.skin)};--hair:${esc(p.hair)};--shirt:${esc(p.shirt)}">
      <div class="av-hairback"></div>
      <div class="av-body"><div class="av-arm l"></div><div class="av-arm r"></div></div>
      <div class="av-head"><div class="av-eyes"></div><div class="av-mouth"></div></div>
      <div class="av-hairtop"></div>
    </div>`;
  }

  function personHTML(p, where) {
    const st = STATUS[p.status] || STATUS.working;
    const prop = where === "break" ? '<div class="prop-cup">☕</div>' : "";
    return `<button type="button" class="person st-${p.status}" data-pid="${p.id}" title="${esc(p.name)} · ${esc(p.role)} · ${st.label}">
      <div class="bubble" data-bubble="${p.id}"></div>
      ${avatarHTML(p)}${prop}
      <span class="nameplate"><i style="background:${st.color}"></i>${esc(p.name)}</span>
    </button>`;
  }

  // ---------- Floor ----------
  function renderFloor() {
    const floor = $("#officeFloor");
    if (!floor) return;

    // FLIP: guardar posiciones antes de volver a dibujar
    const before = {};
    floor.querySelectorAll(".person[data-pid]").forEach(el => { before[el.dataset.pid] = el.getBoundingClientRect(); });

    const rooms = data.departments.map(d => {
      const members = data.people.filter(p => p.deptId === d.id);
      const desks = members.map(p => {
        const atDesk = p.status === "working";
        return `<div class="desk-slot ${atDesk ? "" : "empty"}">
          ${atDesk ? personHTML(p, "desk") : `<div class="chair"></div><span class="ghost-name">${esc(p.name)} · ${STATUS[p.status].icon}</span>`}
          <div class="desk"><div class="monitor ${atDesk ? "on" : ""}"><div class="screen"><span></span><span></span><span></span></div></div><div class="plant">${DESK_ITEMS[hash(p.id) % DESK_ITEMS.length]}</div></div>
        </div>`;
      }).join("");
      const active = members.filter(p => p.status === "working").length;
      return `<section class="room" style="--dept:${esc(d.color)}">
        <header class="room-sign"><span>${esc(d.emoji)} ${esc(d.name)}</span><small>${active}/${members.length} en su puesto</small></header>
        <div class="room-floor">${desks || '<p class="room-empty">Sin personas todavía</p>'}</div>
      </section>`;
    }).join("");

    const meeting = data.people.filter(p => p.status === "meeting");
    const breakers = data.people.filter(p => p.status === "break");
    const away = data.people.filter(p => p.status === "away");

    floor.innerHTML = `
      <div class="rooms">${rooms}</div>
      <div class="common-areas">
        <section class="room meeting-room" style="--dept:#7c3aed">
          <header class="room-sign"><span>🗣️ Sala de reuniones</span><small>${meeting.length ? meeting.length + " en reunión" : "Libre"}</small></header>
          <div class="room-floor meeting-floor">
            <div class="meeting-people">${meeting.map(p => personHTML(p, "meeting")).join("")}</div>
            <div class="meeting-table">${meeting.length ? "📋" : ""}</div>
          </div>
        </section>
        <section class="room cafe-room" style="--dept:#d97706">
          <header class="room-sign"><span>☕ Cafetería</span><small>${breakers.length ? breakers.length + " en pausa" : "Vacía"}</small></header>
          <div class="room-floor cafe-floor">
            <div class="cafe-counter"><span>☕</span><span>🥐</span><span>🍩</span><span>🧃</span></div>
            <div class="cafe-people">${breakers.map(p => personHTML(p, "break")).join("")}</div>
          </div>
        </section>
        <section class="room away-room" style="--dept:#9ca3af">
          <header class="room-sign"><span>🚪 Fuera de la oficina</span><small>${away.length}</small></header>
          <div class="room-floor away-floor">${away.map(p => `<button type="button" class="away-chip" data-pid="${p.id}">🌙 ${esc(p.name)}</button>`).join("") || '<p class="room-empty">Todo el mundo está dentro</p>'}</div>
        </section>
      </div>`;

    // FLIP: animar desde la posición anterior (efecto de caminar)
    floor.querySelectorAll(".person[data-pid]").forEach(el => {
      const old = before[el.dataset.pid];
      if (!old) { el.classList.add("pop-in"); return; }
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left, dy = old.top - now.top;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.classList.add("walking");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.transition = "transform 1.4s cubic-bezier(.45,.05,.35,1)";
        el.style.transform = "";
        setTimeout(() => el.classList.remove("walking"), 1400);
      }));
    });

    renderStats();
  }

  function renderStats() {
    const el = $("#officeStats");
    if (!el) return;
    el.innerHTML = Object.entries(STATUS).map(([k, s]) => {
      const n = data.people.filter(p => p.status === k).length;
      return `<span class="office-stat"><i style="background:${s.color}"></i>${s.icon} ${n} ${s.label.toLowerCase()}</span>`;
    }).join("");
    $("#officeSimToggle").checked = !!data.simulate;
  }

  // ---------- Activity feed ----------
  const feed = [];
  function logEvent(text) {
    const t = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    feed.unshift(`<li><time>${t}</time> ${text}</li>`);
    feed.length = Math.min(feed.length, 30);
    const el = $("#officeFeed");
    if (el) el.innerHTML = feed.join("") || '<li class="hint">Aún no hay actividad.</li>';
  }

  const STATUS_MSG = {
    working: n => `<b>${n}</b> vuelve a su puesto 💻`,
    meeting: n => `<b>${n}</b> entra en la sala de reuniones 🗣️`,
    break:   n => `<b>${n}</b> se va a por un café ☕`,
    away:    n => `<b>${n}</b> sale de la oficina 🚪`,
  };

  function setStatus(p, status) {
    if (p.status === status) return;
    p.status = status;
    persist();
    logEvent(STATUS_MSG[status](esc(p.name)));
    renderFloor();
    if (currentTab === "team") renderTeam();
  }

  // ---------- Speech bubbles ----------
  function sayRandom() {
    const candidates = data.people.filter(p => p.status === "working" || p.status === "meeting");
    if (!candidates.length) return;
    const p = pick(candidates);
    const el = document.querySelector(`[data-bubble="${p.id}"]`);
    if (!el) return;
    const dept = deptById(p.deptId);
    const pool = p.status === "meeting"
      ? ["¿Lo vemos el lunes?", "Buena idea 💡", "Apunto eso 📝", "¿Siguiente punto?", "De acuerdo 👍"]
      : (PHRASES[dept?.name] || PHRASES.default);
    el.textContent = pick(pool);
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3000);
  }

  // ---------- Simulation ----------
  function simulateTick() {
    if (!data.simulate || !isVisible() || !data.people.length) return;
    const p = pick(data.people);
    const r = Math.random();
    let next;
    if (p.status === "working") next = r < 0.45 ? "meeting" : r < 0.9 ? "break" : "away";
    else if (p.status === "away") next = r < 0.5 ? "working" : null;
    else next = r < 0.75 ? "working" : null;
    if (next) setStatus(p, next);
  }

  function isVisible() {
    const m = $("#module-office");
    return m && m.classList.contains("active") && !document.hidden;
  }

  setInterval(simulateTick, 4500);
  setInterval(() => { if (isVisible()) sayRandom(); }, 2200);

  // ---------- Popover (detalle de persona) ----------
  function openPopover(pid, anchor) {
    const p = data.people.find(x => x.id === pid);
    if (!p) return;
    const d = deptById(p.deptId);
    const pop = $("#officePopover");
    pop.innerHTML = `
      <div class="pop-head">${avatarHTML(p, "mini")}<div><strong>${esc(p.name)}</strong><small>${esc(p.role)} · ${esc(d ? d.emoji + " " + d.name : "—")}</small></div>
      <button type="button" class="icon-btn" data-pop-close title="Cerrar">✕</button></div>
      <div class="pop-status">${Object.entries(STATUS).map(([k, s]) =>
        `<button type="button" class="status-btn ${p.status === k ? "active" : ""}" data-set-status="${k}" style="--c:${s.color}">${s.icon} ${s.label}</button>`).join("")}</div>`;
    pop.dataset.pid = pid;
    const r = anchor.getBoundingClientRect();
    pop.style.top = `${window.scrollY + r.bottom + 6}px`;
    pop.style.left = `${Math.max(8, Math.min(window.scrollX + r.left + r.width / 2 - 140, window.scrollX + document.documentElement.clientWidth - 296))}px`;
    pop.classList.add("show");
  }
  function closePopover() { $("#officePopover").classList.remove("show"); }

  // ---------- Team management ----------
  let currentTab = "floor";

  function renderTeam() {
    const deptSel = $("#personDept");
    const keep = deptSel.value;
    deptSel.innerHTML = data.departments.map(d => `<option value="${d.id}">${esc(d.emoji)} ${esc(d.name)}</option>`).join("");
    if (keep && deptById(keep)) deptSel.value = keep;

    $("#deptList").innerHTML = data.departments.map(d => {
      const n = data.people.filter(p => p.deptId === d.id).length;
      return `<div class="list-row"><span class="dept-dot" style="background:${esc(d.color)}"></span>
        <span class="grow">${esc(d.emoji)} ${esc(d.name)} <small class="hint">· ${n} ${n === 1 ? "persona" : "personas"}</small></span>
        <button class="icon-btn" data-edit-dept="${d.id}" title="Editar">✏️</button>
        <button class="icon-btn danger" data-del-dept="${d.id}" title="Eliminar">✕</button></div>`;
    }).join("") || '<p class="hint">No hay departamentos.</p>';

    $("#peopleList").innerHTML = data.people.map(p => {
      const d = deptById(p.deptId), s = STATUS[p.status];
      return `<div class="list-row">${avatarHTML(p, "mini")}
        <span class="grow"><strong>${esc(p.name)}</strong> <small class="hint">${esc(p.role)} · ${d ? esc(d.emoji + " " + d.name) : "—"}</small></span>
        <span class="status-pill" style="--c:${s.color}">${s.icon} ${s.label}</span>
        <button class="icon-btn" data-edit-person="${p.id}" title="Editar">✏️</button>
        <button class="icon-btn danger" data-del-person="${p.id}" title="Eliminar">✕</button></div>`;
    }).join("") || '<p class="hint">Añade a tu primera persona arriba.</p>';
    updatePreview();
  }

  function fillSelect(sel, values, labels) {
    sel.innerHTML = values.map((v, i) => `<option value="${v}">${labels ? labels[i] : v}</option>`).join("");
  }

  function personFromForm() {
    return {
      name: $("#personName").value.trim() || "Nombre",
      role: $("#personRole").value.trim(),
      deptId: $("#personDept").value,
      status: $("#personStatus").value,
      shirt: $("#personShirt").value,
      skin: $("#personSkin").value,
      hair: $("#personHair").value,
      hairStyle: $("#personHairStyle").value,
    };
  }
  function updatePreview() { $("#personPreview").innerHTML = avatarHTML(personFromForm(), "preview"); }

  function resetPersonForm() {
    $("#personForm").reset();
    $("#personId").value = "";
    $("#personShirt").value = "#4f46e5";
    $("#personSkin").value = pick(SKINS);
    $("#personHair").value = pick(HAIRS);
    $("#personFormTitle").textContent = "Nueva persona";
    $("#personSubmitBtn").textContent = "Agregar";
    $("#personCancelBtn").style.display = "none";
    updatePreview();
  }
  function resetDeptForm() {
    $("#deptForm").reset();
    $("#deptId").value = "";
    $("#deptColor").value = "#0ea5e9";
    $("#deptFormTitle").textContent = "Nuevo departamento";
    $("#deptSubmitBtn").textContent = "Agregar";
    $("#deptCancelBtn").style.display = "none";
  }

  function confirmAction(msg, fn) {
    // Reutiliza el modal de confirmación global (definido en app.js)
    if (window.AppConfirm) window.AppConfirm(msg, fn);
    else if (window.confirm(msg)) fn();
  }

  function init() {
    const root = $("#module-office");
    if (!root) return;

    fillSelect($("#personStatus"), Object.keys(STATUS), Object.values(STATUS).map(s => `${s.icon} ${s.label}`));
    fillSelect($("#personSkin"), SKINS, SKINS.map((_, i) => `Tono ${i + 1}`));
    fillSelect($("#personHair"), HAIRS, ["Negro", "Castaño", "Pelirrojo", "Rubio", "Azabache", "Canoso", "Rojo"]);
    fillSelect($("#personHairStyle"), Object.keys(HAIR_STYLES), Object.values(HAIR_STYLES));

    // Tabs
    root.querySelectorAll("[data-office-tab]").forEach(btn => btn.addEventListener("click", () => {
      currentTab = btn.dataset.officeTab;
      root.querySelectorAll("[data-office-tab]").forEach(b => b.classList.toggle("active", b === btn));
      root.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "office-view-" + currentTab));
      if (currentTab === "team") renderTeam(); else renderFloor();
    }));

    $("#officeSimToggle").addEventListener("change", e => {
      data.simulate = e.target.checked; persist();
      logEvent(data.simulate ? "▶️ Simulación activada" : "⏸️ Simulación pausada");
    });
    $("#officeAllWorkBtn").addEventListener("click", () => {
      data.people.forEach(p => { p.status = "working"; });
      persist(); logEvent("📢 ¡Todo el mundo a su puesto!"); renderFloor();
    });
    $("#officeMeetingBtn").addEventListener("click", () => {
      data.people.forEach(p => { if (p.status !== "away") p.status = "meeting"; });
      persist(); logEvent("📣 Reunión general convocada"); renderFloor();
    });

    // Click en persona
    root.addEventListener("click", e => {
      const setBtn = e.target.closest("[data-set-status]");
      if (setBtn) {
        const p = data.people.find(x => x.id === $("#officePopover").dataset.pid);
        if (p) setStatus(p, setBtn.dataset.setStatus);
        closePopover();
        return;
      }
      if (e.target.closest("[data-pop-close]")) { closePopover(); return; }
      const person = e.target.closest(".person[data-pid], .away-chip[data-pid]");
      if (person) { openPopover(person.dataset.pid, person); return; }
      if (!e.target.closest("#officePopover")) closePopover();
    });

    // Formulario de persona
    ["#personName", "#personRole", "#personShirt", "#personSkin", "#personHair", "#personHairStyle"].forEach(s =>
      $(s).addEventListener("input", updatePreview));
    $("#personDept").addEventListener("change", () => {
      const d = deptById($("#personDept").value);
      if (d && !$("#personId").value) { $("#personShirt").value = d.color; updatePreview(); }
    });
    $("#personForm").addEventListener("submit", e => {
      e.preventDefault();
      if (!data.departments.length) { logEvent("⚠️ Crea primero un departamento"); return; }
      const values = personFromForm();
      const id = $("#personId").value;
      if (id) Object.assign(data.people.find(p => p.id === id), values);
      else { data.people.push({ id: uid(), ...values }); logEvent(`👋 <b>${esc(values.name)}</b> se une al equipo`); }
      persist(); resetPersonForm(); renderTeam();
    });
    $("#personCancelBtn").addEventListener("click", resetPersonForm);

    // Formulario de departamento
    $("#deptForm").addEventListener("submit", e => {
      e.preventDefault();
      const values = { name: $("#deptName").value.trim(), emoji: $("#deptEmoji").value.trim() || "🏢", color: $("#deptColor").value };
      if (!values.name) return;
      const id = $("#deptId").value;
      if (id) Object.assign(deptById(id), values);
      else data.departments.push({ id: uid(), ...values });
      persist(); resetDeptForm(); renderTeam();
    });
    $("#deptCancelBtn").addEventListener("click", resetDeptForm);

    // Editar / eliminar
    $("#office-view-team").addEventListener("click", e => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.editPerson) {
        const p = data.people.find(x => x.id === t.dataset.editPerson);
        $("#personId").value = p.id; $("#personName").value = p.name; $("#personRole").value = p.role;
        $("#personDept").value = p.deptId; $("#personStatus").value = p.status; $("#personShirt").value = p.shirt;
        $("#personSkin").value = p.skin; $("#personHair").value = p.hair; $("#personHairStyle").value = p.hairStyle || "short";
        $("#personFormTitle").textContent = `Editar a ${p.name}`;
        $("#personSubmitBtn").textContent = "Guardar";
        $("#personCancelBtn").style.display = "";
        updatePreview();
        $("#personForm").scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (t.dataset.delPerson) {
        const p = data.people.find(x => x.id === t.dataset.delPerson);
        confirmAction(`¿Eliminar a ${p.name} de la oficina?`, () => {
          data.people = data.people.filter(x => x.id !== p.id); persist(); renderTeam();
        });
      } else if (t.dataset.editDept) {
        const d = deptById(t.dataset.editDept);
        $("#deptId").value = d.id; $("#deptName").value = d.name; $("#deptEmoji").value = d.emoji; $("#deptColor").value = d.color;
        $("#deptFormTitle").textContent = `Editar ${d.name}`;
        $("#deptSubmitBtn").textContent = "Guardar";
        $("#deptCancelBtn").style.display = "";
      } else if (t.dataset.delDept) {
        const d = deptById(t.dataset.delDept);
        const n = data.people.filter(p => p.deptId === d.id).length;
        confirmAction(`¿Eliminar el departamento ${d.name}?${n ? ` También se eliminarán sus ${n} personas.` : ""}`, () => {
          data.departments = data.departments.filter(x => x.id !== d.id);
          data.people = data.people.filter(p => p.deptId !== d.id);
          persist(); renderTeam();
        });
      }
    });

    // Reloj
    const tick = () => { const c = $("#officeClock"); if (c) c.textContent = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }); };
    tick(); setInterval(tick, 10000);

    resetPersonForm();
    resetDeptForm();
    logEvent("🏢 La oficina abre sus puertas");
    renderFloor();
  }

  // API pública para el módulo principal (cambio de módulo, export/import)
  window.OfficeModule = {
    render() { if (currentTab === "team") renderTeam(); else renderFloor(); },
    getData() { return data; },
    setData(d) {
      data = d && Array.isArray(d.departments) ? d : defaultData();
      persist(); this.render();
    },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
