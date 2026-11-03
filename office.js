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
    "Dirección": ["Revisando objetivos del mes 📈", "Cerrando un cliente nuevo ✍️", "¡Buen trabajo, equipo!", "Preparando la estrategia", "¿Cómo va el canal?"],
    "Guiones": ["Transforma → Segmenta ✍️", "Puliendo la INTRODUCCIÓN", "Este gancho es 🔥", "Buscando vídeo de inspiración", "Guion de 12 min listo 📝"],
    "Edición": ["Renderizando en Remotion 🎬", "Modo pantalla 2.0 ✨", "Subtítulos al 80%", "Máster para YouTube listo 📤", "Ajustando el cristal y la luz 💡"],
    "Miniaturas": ["¿Amarillo o dorado? 🎨", "Probando 3 miniaturas", "CTR al alza 📊", "Exportando a 1280×720", "Esta cara funciona 😄"],
    "Redes": ["Programando el reel 📱", "¡Viral en Instagram! 🚀", "Respondiendo comentarios 💬", "Doble personaje grabado 🎭", "Subiendo el short"],
    "Clientes": ["Actualizando ficha de cliente 📋", "Llamada con cliente a las 12 📞", "Enviando la entrega ✅", "Onboarding nuevo 🤝", "Feedback recibido 👍"],
    "Ventas": ["¡Cerré una venta! 🎉", "Grabando la VSL 🎥", "Seguimiento del lead", "Enviando propuesta", "Caso de éxito nuevo 🏆"],
    "Finanzas": ["Cuadrando el balance 💰", "Facturas al día ✅", "Revisando el flujo de caja", "Cerrando el mes 📊", "Personal vs empresa 🧾"],
    "Canal propio": ["Grabando para el canal 🎙️", "Ideas para el próximo vídeo 💡", "Analizando retención 📈", "Programando estreno 📅"],
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
      { id: uid(), name: "Dirección",    emoji: "👔", color: "#4f46e5" },
      { id: uid(), name: "Guiones",      emoji: "✍️", color: "#0891b2" },
      { id: uid(), name: "Edición",      emoji: "🎬", color: "#db2777" },
      { id: uid(), name: "Miniaturas",   emoji: "🎨", color: "#eab308" },
      { id: uid(), name: "Redes",        emoji: "📱", color: "#9333ea" },
      { id: uid(), name: "Clientes",     emoji: "🤝", color: "#ea580c" },
      { id: uid(), name: "Ventas",       emoji: "📈", color: "#dc2626" },
      { id: uid(), name: "Finanzas",     emoji: "💰", color: "#16a34a" },
      { id: uid(), name: "Canal propio", emoji: "🎙️", color: "#0f766e" },
    ];
    const people = [
      ["Arturo", "CEO y creador", 0, "short", "Estrategia de contenido, Negociación, YouTube, Marca personal", "Revisar objetivos del mes|Cerrar propuesta con cliente nuevo|Grabar vídeo del canal"],
      ["Laura", "Directora de operaciones", 0, "long", "Gestión de proyectos, Notion, Procesos, Planificación", "Planificar entregas de la semana|Revisar carga del equipo de edición|Actualizar el calendario editorial"],
      ["Mario", "Guionista YouTube (ScriptMaster)", 1, "curly", "ScriptMaster, Storytelling, Retención, Investigación", "Guion de 12 min para cliente A|Transformar transcripción de referencia|Segmentar guion del canal"],
      ["Claudia", "Guionista Reels y TikTok", 1, "bun", "Ganchos virales, Formatos cortos, Tendencias, Copy", "5 guiones de reels para cliente B|Guion 'Doble personaje'|Buscar vídeos de inspiración"],
      ["Diego", "Editor Remotion (YouTube)", 2, "curly", "Remotion, React, After Effects, Corrección de color", "Montar vídeo largo cliente A|Modo pantalla 2.0 en el capítulo 3|Exportar máster para YouTube"],
      ["Valeria", "Editora de Reels", 2, "long", "Remotion, Subtítulos dinámicos, Ritmo, CapCut", "Editar 3 reels cliente B|Subtítulos del reel de hoy|Aplicar estilo Jan × Arturo"],
      ["Nico", "Editor de VSL", 2, "short", "VSL, Casos de éxito, Motion graphics, Audio", "Montar VSL del lanzamiento|Insertar casos de éxito|Botón de CTA animado"],
      ["Sofía", "Diseñadora de miniaturas", 3, "long", "Photoshop, Composición, Tipografía, Pruebas A/B", "3 variantes de miniatura vídeo A|Exportar miniatura 1280×720|Revisar CTR de la semana"],
      ["Paula", "Community manager", 4, "bun", "Instagram, Copywriting, Programación de contenido, Analítica", "Programar reels de la semana|Responder comentarios|Informe de alcance"],
      ["Iván", "Gestor de Instagram", 4, "short", "Instagram Ads, Crecimiento, Colaboraciones, Stories", "Subir stories del cliente C|Contactar 3 colaboradores|Revisar campaña de ads"],
      ["Lucía", "Account manager", 5, "long", "Atención al cliente, Fichas de cliente, Seguimiento, Presentaciones", "Actualizar ficha de cliente B|Llamada semanal con cliente A|Enviar entrega del vídeo"],
      ["Hugo", "Onboarding de clientes", 5, "bald", "Onboarding, Formularios, Documentación, Soporte", "Onboarding del cliente nuevo|Preparar cuestionario inicial|Crear carpeta compartida"],
      ["Javier", "Closer de ventas", 6, "short", "Ventas, Llamadas de cierre, CRM, Objeciones", "Llamada de cierre a las 12|Seguimiento de 4 leads|Enviar propuesta a cliente D"],
      ["Marta", "Contable", 7, "bun", "Contabilidad, Facturación, Impuestos, Excel", "Emitir facturas del mes|Cuadrar banco con la app|Preparar el cierre trimestral"],
      ["Elena", "Productora del canal", 8, "curly", "Producción, Grabación, Iluminación, Planificación de rodajes", "Preparar rodaje del jueves|Lista de ideas para el canal|Analizar retención del último vídeo"],
    ].map(([name, role, di, hairStyle, skills, tasks], i) => ({
      id: uid(), name, role, deptId: d[di].id, hairStyle,
      skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 3) % HAIRS.length],
      shirt: d[di].color, status: i % 6 === 5 ? "break" : "working",
      skills: skills.split(",").map(x => x.trim()),
      tasks: tasks.split("|").map(text => ({ id: uid(), text, done: false })),
    }));
    return { version: 3, departments: d, people, simulate: true };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.error("Error leyendo oficina", e); }
    return null;
  }
  let data = load();
  if (!data || !data.version || data.version < 2) data = defaultData();
  if (data.version === 2) {
    // Datos de ejemplo de la versión anterior (sin conocimientos ni tareas): se completan
    const fresh = defaultData();
    const untouched = data.people.every(p => fresh.people.some(f => f.name === p.name && f.role === p.role));
    if (untouched) data = fresh;
    else { data.people.forEach(p => { p.skills = p.skills || []; p.tasks = p.tasks || []; }); data.version = 3; }
  }
  function persist() { localStorage.setItem(KEY, JSON.stringify(data)); }
  persist();

  const deptById = id => data.departments.find(d => d.id === id);
  const skillsOf = p => Array.isArray(p.skills) ? p.skills : [];
  const tasksOf = p => Array.isArray(p.tasks) ? p.tasks : [];
  const currentTask = p => tasksOf(p).find(t => !t.done) || null;
  const parseSkills = str => str.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  function parseTasks(str, prev) {
    return str.split("\n").map(x => x.trim()).filter(Boolean).map(text => {
      const old = (prev || []).find(t => t.text === text);
      return old || { id: uid(), text, done: false };
    });
  }

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
  const use3D = () => !!(window.Office3D && window.Office3D.available() && data.view3d !== false);

  function renderFloor() {
    const floor = $("#officeFloor");
    if (!floor) return;
    if (use3D()) {
      if (!floor.classList.contains("office-3d")) {
        floor.classList.add("office-3d");
        window.Office3D.mount(floor, { openPopover, log: logEvent, STATUS });
      }
      window.Office3D.sync(data);
      renderStats();
      renderFloorSelect();
      return;
    }
    if (floor.classList.contains("office-3d")) { floor.classList.remove("office-3d"); window.Office3D.unmount(); }

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

  function renderFloorSelect() {
    const sel = $("#officeFloorSelect");
    if (!sel) return;
    const keep = sel.value;
    const opts = window.Office3D.floorsList();
    sel.innerHTML = '<option value="">🏢 Edificio entero</option>' + opts.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join("");
    sel.value = opts.some(f => f.id === keep) ? keep : "";
    sel.style.display = "";
  }

  function renderStats() {
    const el = $("#officeStats");
    if (!el) return;
    el.innerHTML = Object.entries(STATUS).map(([k, s]) => {
      const n = data.people.filter(p => p.status === k).length;
      return `<span class="office-stat"><i style="background:${s.color}"></i>${s.icon} ${n} ${s.label.toLowerCase()}</span>`;
    }).join("");
    $("#officeSimToggle").checked = !!data.simulate;
    const vb = $("#officeViewBtn");
    if (vb) {
      vb.style.display = window.Office3D && window.Office3D.available() ? "" : "none";
      vb.textContent = use3D() ? "🗺️ Ver en 2D" : "🧊 Ver en 3D";
    }
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
    const el = use3D() ? null : document.querySelector(`[data-bubble="${p.id}"]`);
    if (!el && !use3D()) return;
    const dept = deptById(p.deptId);
    const pool = p.status === "meeting"
      ? ["¿Lo vemos el lunes?", "Buena idea 💡", "Apunto eso 📝", "¿Siguiente punto?", "De acuerdo 👍"]
      : (PHRASES[dept?.name] || PHRASES.default);
    const task = p.status === "working" ? currentTask(p) : null;
    const text = task && Math.random() < 0.6 ? `📌 ${task.text}` : pick(pool);
    if (use3D()) { window.Office3D.say(p.id, text); return; }
    el.textContent = text;
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
        `<button type="button" class="status-btn ${p.status === k ? "active" : ""}" data-set-status="${k}" style="--c:${s.color}">${s.icon} ${s.label}</button>`).join("")}</div>
      <div class="pop-section"><h4>🧠 Conocimientos</h4>
        <div class="skills-line">${skillsOf(p).map(k => `<span class="skill-chip">${esc(k)}</span>`).join("") || '<span class="hint">Ninguno todavía</span>'}</div></div>
      <div class="pop-section"><h4>📋 Tareas</h4>
        <ul class="task-list">${tasksOf(p).map(t => `<li class="${t.done ? "done" : ""}"><label><input type="checkbox" data-task="${t.id}" ${t.done ? "checked" : ""}> ${esc(t.text)}</label></li>`).join("") || '<li class="hint">Ninguna todavía</li>'}</ul>
        <form class="task-add" data-task-add><input type="text" placeholder="Nueva tarea…" maxlength="80"><button type="submit" class="secondary-btn">+</button></form></div>
      <button type="button" class="link-btn pop-edit" data-pop-edit="${p.id}">✏️ Editar ficha completa</button>`;
    pop.dataset.pid = pid;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
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
      const pending = tasksOf(p).filter(t => !t.done).length, total = tasksOf(p).length;
      return `<div class="list-row person-row">${avatarHTML(p, "mini")}
        <span class="grow"><strong>${esc(p.name)}</strong> <small class="hint">${esc(p.role)} · ${d ? esc(d.emoji + " " + d.name) : "—"}</small>
          <span class="skills-line">${skillsOf(p).map(k => `<span class="skill-chip">${esc(k)}</span>`).join("") || '<span class="hint">Sin conocimientos registrados</span>'}</span>
          ${total ? `<small class="hint">📋 ${pending} de ${total} tareas pendientes${currentTask(p) ? ` · ahora: ${esc(currentTask(p).text)}` : ""}</small>` : '<small class="hint">📋 Sin tareas</small>'}
        </span>
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
      skills: parseSkills($("#personSkills").value),
      tasks: parseTasks($("#personTasks").value, editingTasks),
    };
  }
  let editingTasks = [];
  function updatePreview() { $("#personPreview").innerHTML = avatarHTML(personFromForm(), "preview"); }

  function resetPersonForm() {
    $("#personForm").reset();
    $("#personId").value = "";
    editingTasks = [];
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
    $("#officeViewBtn").addEventListener("click", () => {
      data.view3d = !use3D(); persist();
      $("#officeFloorSelect").style.display = "none";
      renderFloor();
    });
    $("#officeFloorSelect").addEventListener("change", e => {
      if (use3D()) window.Office3D.focusFloor(e.target.value);
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
      const editBtn = e.target.closest("[data-pop-edit]");
      if (editBtn) {
        closePopover();
        root.querySelector('[data-office-tab="team"]').click();
        const b = document.querySelector(`[data-edit-person="${editBtn.dataset.popEdit}"]`);
        if (b) b.click();
        return;
      }
      if (e.target.closest("#officePopover")) {
        const cb = e.target.closest("[data-task]");
        if (cb) {
          const p = data.people.find(x => x.id === $("#officePopover").dataset.pid);
          const t = p && tasksOf(p).find(t => t.id === cb.dataset.task);
          if (t) {
            t.done = cb.checked; persist();
            cb.closest("li").classList.toggle("done", t.done);
            if (t.done) logEvent(`✅ <b>${esc(p.name)}</b> termina: ${esc(t.text)}`);
            if (currentTab === "team") renderTeam();
          }
        }
        return;
      }
      const person = e.target.closest(".person[data-pid], .away-chip[data-pid]");
      if (person) { openPopover(person.dataset.pid, person); return; }
      if (!e.target.closest("#officePopover")) closePopover();
    });

    root.addEventListener("submit", e => {
      const f = e.target.closest("[data-task-add]");
      if (!f) return;
      e.preventDefault();
      const inp = f.querySelector("input");
      const text = inp.value.trim();
      const p = data.people.find(x => x.id === $("#officePopover").dataset.pid);
      if (!text || !p) return;
      if (!Array.isArray(p.tasks)) p.tasks = [];
      p.tasks.push({ id: uid(), text, done: false });
      persist();
      logEvent(`📌 Nueva tarea para <b>${esc(p.name)}</b>: ${esc(text)}`);
      const li = document.createElement("li");
      li.innerHTML = `<label><input type="checkbox" data-task="${p.tasks[p.tasks.length - 1].id}"> ${esc(text)}</label>`;
      f.previousElementSibling.querySelector(".hint")?.remove();
      f.previousElementSibling.appendChild(li);
      inp.value = "";
      if (currentTab === "team") renderTeam();
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
    $("#officeResetBtn").addEventListener("click", () => {
      confirmAction("Esto sustituirá tus departamentos y personas por el equipo de ejemplo. ¿Continuar?", () => {
        data = defaultData(); persist(); logEvent("🔄 Equipo restablecido"); renderTeam();
      });
    });

    // Editar / eliminar
    $("#office-view-team").addEventListener("click", e => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.editPerson) {
        const p = data.people.find(x => x.id === t.dataset.editPerson);
        $("#personId").value = p.id; $("#personName").value = p.name; $("#personRole").value = p.role;
        $("#personDept").value = p.deptId; $("#personStatus").value = p.status; $("#personShirt").value = p.shirt;
        $("#personSkin").value = p.skin; $("#personHair").value = p.hair; $("#personHairStyle").value = p.hairStyle || "short";
        $("#personSkills").value = skillsOf(p).join(", ");
        $("#personTasks").value = tasksOf(p).map(t => t.text).join("\n");
        editingTasks = tasksOf(p);
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
