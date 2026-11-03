// ---------- Oficina virtual ----------
// Módulo independiente: departamentos con personas trabajando, sala de reuniones,
// simulación en vivo, cerebro de cada trabajador y gestión del equipo. Persiste en localStorage.
(function () {
  "use strict";

  const KEY = "ft_office";
  const $ = sel => document.querySelector(sel);

  const STATUS = {
    working: { label: "Trabajando", icon: "💻", color: "#16a34a" },
    meeting: { label: "En reunión", icon: "🗣️", color: "#7c3aed" },
  };

  const SKINS = ["#f5d0b5", "#e8b896", "#d29b72", "#a86e47", "#7a4a2a", "#f1c9a5"];
  const HAIRS = ["#2b1d14", "#5a3a22", "#a0522d", "#d4a24c", "#1c1c1c", "#8b8b8b", "#c0392b"];
  const HAIR_STYLES = { short: "Corto", long: "Largo", bun: "Moño", curly: "Rizado", bald: "Calvo" };

  const PHRASES = {
    default: ["Un momento…", "¡Listo! ✅", "Revisando correos 📧", "Casi termino"],
    "Dirección": ["Revisando objetivos del mes 📈", "Cerrando un cliente nuevo ✍️", "¡Buen trabajo, equipo!", "Preparando la estrategia"],
    "Contenido": ["Renderizando en Remotion 🎬", "¿Amarillo o dorado? 🎨", "Este gancho es 🔥", "Sacando clips del vídeo largo ✂️", "Programando la publicación 📅", "Subtítulos al 80%"],
    "Clientes": ["Onboarding del cliente nuevo 🤝", "Respondiendo DMs 📩", "Enviando accesos y cuestionario 📋", "Kickoff a las 12 📞"],
    "Finanzas": ["Cuadrando el balance 💰", "Facturas al día ✅", "Revisando el flujo de caja", "Cerrando el mes 📊"],
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const DESK_ITEMS = ["🪴", "📚", "🖊️", "☕", "📎", "🌵", "🧸", "🎧"];
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const ONBOARDING_PROCESS = `PROCESO DE ONBOARDING DE UN CLIENTE NUEVO

1. Definir la ubicación de grabación de los clones (dónde y cuándo se graba al cliente).
2. Crear el grupo de WhatsApp con Arturo, el cliente y Javi (el camarógrafo).
3. Enviar al cliente el documento de onboarding.
4. Enviar al cliente el contrato para que lo firme.
5. Decirle que se descargue la app de HeyGen y enviarle el enlace de afiliado de HeyGen de Arturo.
6. Darle acceso a la comunidad de Skool de Arturo.
7. Cuando el cliente haya rellenado el documento de onboarding, fijar la llamada de onboarding.
8. Crear las carpetas de Drive donde se va a alojar todo el material del cliente.
9. Una vez hecha la grabación, importar y generar los clones de inteligencia artificial en HeyGen.

Reglas:
- No fijar la llamada de onboarding hasta que el documento de onboarding esté rellenado.
- Los clones solo se generan cuando la grabación esté hecha.
- Cada paso se marca como hecho en la ficha del cliente.`;

  function defaultData() {
    const d = [
      { id: uid(), name: "Dirección", emoji: "👔", color: "#4f46e5" },
      { id: uid(), name: "Contenido", emoji: "🎬", color: "#db2777" },
      { id: uid(), name: "Clientes",  emoji: "🤝", color: "#ea580c" },
      { id: uid(), name: "Finanzas",  emoji: "💰", color: "#16a34a" },
    ];
    const people = [
      ["Arturo", "CEO y creador", 0, "short", "Estrategia de contenido, Negociación, YouTube, Marca personal", "Revisar objetivos del mes|Cerrar propuesta con cliente nuevo", ""],
      ["Sofía", "Diseñadora de miniaturas", 1, "long", "Photoshop, Composición, Tipografía, Pruebas A/B de miniaturas", "3 variantes de miniatura del vídeo A|Exportar miniatura 1280×720", ""],
      ["Diego", "Editor de vídeos de YouTube", 1, "curly", "Remotion, Edición de vídeo largo, Corrección de color, Ritmo narrativo", "Montar vídeo largo del cliente A|Exportar máster para YouTube", ""],
      ["Nico", "Editor de clips (de largo a corto)", 1, "short", "Detección de momentos virales, Reencuadre 9:16, Subtítulos dinámicos", "Sacar 5 clips del vídeo largo A|Subtitular los clips", ""],
      ["Valeria", "Editora de reels", 1, "bun", "Remotion, Estilo Jan × Arturo, Transiciones, Audio", "Editar 3 reels del cliente B|Aplicar estilo mostaza al reel 2", ""],
      ["Claudia", "Guionista de reels", 1, "long", "Ganchos virales, Formatos Recrear/Reacción/Doble personaje, Tendencias, Copy", "5 guiones de reels para cliente B|Buscar vídeos de inspiración", ""],
      ["Iván", "Publicador de vídeos", 1, "short", "YouTube Studio, Instagram, Programación, Títulos y descripciones SEO", "Programar los reels de la semana|Publicar vídeo largo A con capítulos", ""],
      ["Hugo", "Agente de onboarding de clientes", 2, "bald", "Onboarding de clientes, Grupos de WhatsApp, Contratos, HeyGen (app, afiliado y clones), Comunidad Skool, Drive, Llamada de onboarding", "Definir ubicación de grabación de clones|Crear grupo de WhatsApp (Arturo, cliente y Javi)|Enviar documento de onboarding|Enviar contrato para firmar|Enviar enlace de HeyGen (app + afiliado)|Dar acceso a la comunidad de Skool|Fijar llamada de onboarding cuando esté rellenado|Crear carpetas de Drive del cliente|Importar y generar clones en HeyGen tras la grabación", ONBOARDING_PROCESS],
      ["Paula", "Gestora de DMs de Instagram", 2, "bun", "Atención por DM, Tono de marca, Cualificación de leads, Respuestas rápidas", "Responder DMs pendientes|Pasar leads cualificados a Arturo", ""],
      ["Marta", "Contable", 3, "curly", "Contabilidad, Facturación, Impuestos, Excel", "Emitir facturas del mes|Cuadrar banco con la app|Preparar el cierre trimestral", ""],
    ].map(([name, role, di, hairStyle, skills, tasks, knowledge], i) => ({
      id: uid(), name, role, deptId: d[di].id, hairStyle,
      skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 3) % HAIRS.length],
      shirt: d[di].color, status: "working",
      skills: skills.split(",").map(x => x.trim()),
      tasks: tasks.split("|").map(text => ({ id: uid(), text, done: false })),
      knowledge: knowledge ? [{ id: uid(), type: "nota", title: "Proceso de onboarding", content: knowledge, createdAt: new Date().toISOString() }] : [],
    }));
    return { version: 4, departments: d, people, simulate: true };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.error("Error leyendo oficina", e); }
    return null;
  }
  let data = load();
  if (!data || !data.version || data.version < 4) {
    const fresh = defaultData();
    // Si el equipo es el de ejemplo de una versión anterior, se sustituye; si lo habías editado, se conserva.
    const sampleNames = ["Arturo", "Laura", "Mario", "Claudia", "Diego", "Valeria", "Nico", "Sofía", "Paula", "Iván", "Lucía", "Hugo", "Javier", "Marta", "Elena", "Carlos", "Lucía", "Andrea", "Pablo", "Elena"];
    const untouched = !data || !Array.isArray(data.people) || data.people.every(p => sampleNames.includes(p.name));
    if (untouched) data = fresh;
    else { data.version = 4; }
  }
  data.people.forEach(p => {
    if (p.status !== "meeting") p.status = "working";
    if (!Array.isArray(p.skills)) p.skills = [];
    if (!Array.isArray(p.tasks)) p.tasks = [];
    if (!Array.isArray(p.knowledge)) p.knowledge = [];
  });
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

    floor.innerHTML = `
      <div class="rooms">${rooms}</div>
      <div class="common-areas">
        <section class="room meeting-room" style="--dept:#7c3aed">
          <header class="room-sign"><span>🗣️ Sala de reuniones</span><small>${meeting.length ? esc(currentMeeting ? currentMeeting.topic : meeting.length + " en reunión") : "Libre"}</small></header>
          <div class="room-floor meeting-floor">
            <div class="meeting-people">${meeting.map(p => personHTML(p, "meeting")).join("")}</div>
            <div class="meeting-table">${meeting.length ? "📋" : ""}</div>
          </div>
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
  };

  function setStatus(p, status) {
    if (p.status === status) return;
    if (currentMeeting && status !== "meeting") {
      currentMeeting.pids = currentMeeting.pids.filter(id => id !== p.id);
      if (currentMeeting.pids.length < 2) { p.status = status; endMeeting(); return; }
    }
    if (status === "meeting" && currentMeeting && !currentMeeting.pids.includes(p.id)) currentMeeting.pids.push(p.id);
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
      ? ["Buena idea 💡", "Apunto eso 📝", "¿Siguiente punto?", "De acuerdo 👍", "Lo tengo listo mañana ✅", "¿Me pasas el material?"]
      : (PHRASES[dept?.name] || PHRASES.default);
    const task = p.status === "working" ? currentTask(p) : null;
    const text = task && Math.random() < 0.6 ? `📌 ${task.text}` : pick(pool);
    el.textContent = text;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 3000);
  }

  // ---------- Simulation ----------
  // Reuniones entre agentes: solo cuando dos o más personas colaboran en algo concreto
  let currentMeeting = null; // { topic, pids, until }
  const MEETING_TOPICS = [
    (a, b) => `${a.name} y ${b.name} coordinan: ${currentTask(a) ? currentTask(a).text : "la entrega de la semana"}`,
    (a, b) => `${a.name} pide feedback a ${b.name}: ${currentTask(a) ? currentTask(a).text : "su tarea"}`,
    (a, b) => `${b.name} entrega a ${a.name}: ${currentTask(b) ? currentTask(b).text : "material"}`,
  ];
  function startMeeting(pids, topic) {
    const people = pids.map(id => data.people.find(p => p.id === id)).filter(Boolean);
    if (people.length < 2) return;
    currentMeeting = { topic, pids: people.map(p => p.id), until: Date.now() + 25000 + Math.random() * 20000 };
    people.forEach(p => { p.status = "meeting"; });
    persist();
    logEvent(`🗣️ <b>Reunión</b>: ${esc(topic)}`);
    renderFloor();
    if (currentTab === "team") renderTeam();
  }
  function endMeeting() {
    if (!currentMeeting) return;
    const m = currentMeeting; currentMeeting = null;
    m.pids.forEach(id => { const p = data.people.find(x => x.id === id); if (p && p.status === "meeting") p.status = "working"; });
    persist();
    logEvent(`✅ Reunión terminada: ${esc(m.topic)}`);
    renderFloor();
    if (currentTab === "team") renderTeam();
  }
  function simulateTick() {
    if (!isVisible()) return;
    if (currentMeeting && Date.now() > currentMeeting.until) { endMeeting(); return; }
    if (!data.simulate || currentMeeting || data.people.length < 2) return;
    if (Math.random() > 0.18) return;
    const working = data.people.filter(p => p.status === "working");
    if (working.length < 2) return;
    const a = pick(working);
    // Preferir a alguien del mismo departamento (colaboran en la misma cadena de trabajo)
    const same = working.filter(p => p.id !== a.id && p.deptId === a.deptId);
    const b = pick(same.length && Math.random() < 0.7 ? same : working.filter(p => p.id !== a.id));
    const pids = [a.id, b.id];
    if (same.length > 1 && Math.random() < 0.3) { const c = pick(same.filter(p => p.id !== b.id)); if (c) pids.push(c.id); }
    startMeeting(pids, pick(MEETING_TOPICS)(a, b));
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
      <div class="pop-actions"><button type="button" class="primary-btn" data-open-brain="${p.id}">🧠 Abrir cerebro</button>
      <button type="button" class="link-btn pop-edit" data-pop-edit="${p.id}">✏️ Editar ficha</button></div>`;
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
        <button class="icon-btn" data-open-brain="${p.id}" title="Cerebro (${(p.knowledge || []).length} conocimientos)">🧠</button>
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

  // ---------- CEO: reparte las peticiones entre el equipo ----------
  const STOP = new Set("de del la las el los un una unos unas y o a al en con para por que se su sus es hay hacer haz tiene tienen este esta esto eso ese esa lo le les mi me nos ya muy mas más también sobre como cómo cuando donde todo toda todos todas otra otro otros otras cada".split(" "));
  const SYN = [
    [/^(editar|edicion|editor|editora|montar|montaje|montado|render)/, "edicion"],
    [/^(miniatura|thumbnail|portada)/, "miniatura"],
    [/^(reel|reels|tiktok|short|shorts|vertical)/, "reels"],
    [/^(clip|clips|recorte|recortes|corte|cortes|trocear)/, "clips"],
    [/^(public|programar|programacion|programad|subir|subid|subim)/, "publicar"],
    [/^(onboarding|alta|bienvenida|incorporar|incorporacion)/, "onboarding"],
    [/^(whatsapp|contrato|contratos|heygen|skool|drive|clon|clones|camarografo|grabacion)/, "onboarding"],
    [/^(dm|dms|mensaje|mensajes|directo|directos|responder|respuesta|respuestas|inbox)/, "dm"],
    [/^(factura|facturas|facturar|facturacion|cobro|cobros|cobrar|pago|pagos|contabilidad|contable|impuesto|impuestos|balance|gasto|gastos|ingreso|ingresos)/, "finanzas"],
    [/^(guion|guiones|guionista|escribir|redactar|gancho|ganchos)/, "guion"],
    [/^(titulo|titulos|descripcion|descripciones|seo)/, "titulo"],
    [/^(sacar|extraer|trocea)/, "clips"],
    [/^(revis|aprobar|aprobacion|validar|supervisar|ok$)/, "revision"],
    [/^(youtube|largo|largos)/, "youtube"],
    [/^(video|videos|vídeo|vídeos)/, "video"],
    [/^(estrategia|decidir|decision|propuesta|objetivo|objetivos|negociar|negociacion)/, "direccion"],
    [/^(instagram|ig)/, "instagram"],
  ];
  function tokens(text) {
    const out = new Set();
    String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9ñ]+/).forEach(w => {
      if (w.length < 2 || STOP.has(w)) return;
      const syn = SYN.find(([re]) => re.test(w));
      out.add(syn ? syn[1] : w);
    });
    // "sacar reels/clips de un vídeo" son clips, no reels nuevos
    if (out.has("clips")) out.delete("reels");
    return out;
  }
  const CLAUSE_SPLIT = /[,.;\n]+|\s+y\s+(?=(?:adem[aá]s|luego|despu[eé]s|tambi[eé]n|quiero|hay|tengo|necesito|editar|edita|sacar|saca|crear|crea|hacer|haz|publicar|publica|grabar|montar|subir|programar|responder|revisar|me\s|que\s|lo\s|una\s))/i;
  function splitClauses(text) {
    return String(text).split(CLAUSE_SPLIT).map(c => c.trim().replace(/^(?:y|e|o|adem[aá]s|luego|despu[eé]s|tambi[eé]n|entonces|pues|que)\s+/i, "").trim()).filter(c => c.length > 2);
  }
  function cleanTask(clause) {
    let t = clause.replace(/^(?:hay que|quiero|tengo que|necesito|hace falta|habr[ií]a que|vamos a|me gustar[ií]a)\s+/i, "").trim();
    if (/^(?:el|la|los|las|un|una|unos|unas)\s/i.test(t)) t = "Hacer " + t;
    if (/^una vez/i.test(t)) t = t.replace(/^una vez\s+/i, "Cuando ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function onboardingNames(clause) {
    const m = clause.match(/onboarding\s+(?:de|del|a|para)\s+(.+)$/i);
    if (!m) return [];
    return m[1].split(/\s*,\s*|\s+y\s+(?:de\s+|del\s+|a\s+)?|\s+e\s+(?:de\s+)?/i).map(n => n.replace(/^(?:de|del|a|para)\s+/i, "").trim()).filter(n => n && n.split(/\s+/).length <= 3).map(n => n.charAt(0).toUpperCase() + n.slice(1));
  }
  function ceo() {
    if (data.ceoId) { const c = data.people.find(p => p.id === data.ceoId); if (c) return c; }
    const dir = data.departments.find(d => /direcci/i.test(d.name));
    return data.people.find(p => /ceo|director|directora|fundador|fundadora/i.test(p.role)) || (dir && data.people.find(p => p.deptId === dir.id)) || data.people[0];
  }
  function workerKeywords(p) {
    const d = deptById(p.deptId);
    const t = tokens([p.role, ...skillsOf(p), d ? d.name : "", ...(p.knowledge || []).map(k => k.title)].join(" "));
    return t;
  }
  // Plan por frases: cada frase se asigna a quien mejor encaja con su puesto y conocimientos.
  // Devuelve [{pid, tasks, matches, why}] en orden.
  function planDistribution(request) {
    const boss = ceo();
    const workers = data.people.filter(p => p !== boss).map(p => ({ p, kw: workerKeywords(p) }));
    const items = [];
    const add = (person, task, matches, why) => {
      let it = items.find(x => x.pid === person.id);
      if (!it) { it = { pid: person.id, tasks: [], matches: [], why }; items.push(it); }
      if (!it.tasks.includes(task)) it.tasks.push(task);
      matches.forEach(m => { if (!it.matches.includes(m)) it.matches.push(m); });
    };
    let reviewSeen = false, unmatched = [];
    splitClauses(request).forEach(clause => {
      const toks = tokens(clause);
      if (!toks.size) return;
      const text = cleanTask(clause);
      if (toks.has("revision")) {
        reviewSeen = true;
        add(boss, `Revisión final y OK (${cleanTask(clause).replace(/^Hacer\s+/i, "")})`, ["revision"], "revisión");
        return;
      }
      if (toks.has("onboarding")) {
        const names = onboardingNames(clause);
        const best = workers.filter(w => w.kw.has("onboarding")).sort((a, b) => b.kw.size - a.kw.size)[0];
        if (best) {
          const proc = (best.p.knowledge || []).find(k => /onboarding/i.test(k.title) && /^\s*\d+[.)]/m.test(k.content));
          const steps = proc ? proc.content.split("\n").map(l => (l.match(/^\s*\d+[.)]\s*(.+)$/) || [])[1]).filter(Boolean) : [];
          (names.length ? names : [""]).forEach(n => {
            const tag = n ? `[Onboarding ${n}]` : "[Onboarding]";
            if (steps.length) steps.forEach(st => add(best.p, `${tag} ${st.trim()}`, ["onboarding"], "onboarding"));
            else add(best.p, n ? `Onboarding de ${n}` : text, ["onboarding"], "onboarding");
          });
          return;
        }
      }
      const scored = workers.map(w => {
        const matches = [...toks].filter(t => w.kw.has(t));
        const strong = matches.filter(m => m !== "video" && m !== "instagram");
        return { w, score: strong.length + (matches.length - strong.length) * 0.3, matches };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
      if (!scored.length) { unmatched.push(text); return; }
      const top = scored[0].score;
      const chosen = scored.filter(x => x.score === top);
      chosen.forEach(x => {
        let task = text;
        if (x.matches.includes("publicar") && reviewSeen) task += ` (cuando ${boss.name} lo haya revisado)`;
        add(x.w.p, task, x.matches, x.matches.join(", "));
      });
    });
    unmatched.forEach(t => add(boss, `Por asignar: ${t}`, ["sin encaje"], "sin encaje"));
    return items;
  }
  function shortText(t) { t = t.trim().replace(/\s+/g, " "); return t.length > 90 ? t.slice(0, 87) + "…" : t; }

  let pendingPlan = null;
  function askCeo(request) {
    const boss = ceo();
    if (!boss) return;
    const items = planDistribution(request);
    if (!items.length) {
      pendingPlan = null;
      $("#ceoPlan").innerHTML = `<p class="ceo-reply">🧑‍💼 <b>${esc(boss.name)}</b>: no he entendido qué hay que hacer. Dímelo con verbos concretos: onboarding de X, editar el vídeo, sacar clips, miniatura, título, reels, publicar, responder DMs, facturar…</p>`;
      return;
    }
    pendingPlan = { request, items };
    renderPlan();
  }
  function renderPlan() {
    const boss = ceo();
    const box = $("#ceoPlan");
    if (!pendingPlan) { box.innerHTML = ""; return; }
    const options = pid => data.people.map(p => `<option value="${p.id}" ${p.id === pid ? "selected" : ""}>${esc(p.name)} · ${esc(p.role)}</option>`).join("");
    box.innerHTML = `<p class="ceo-reply">🧑‍💼 <b>${esc(boss.name)}</b>: lo reparto así. Cambia a quien quieras y confirma.</p>
      <div class="plan-list">${pendingPlan.items.map((it, i) => {
        const p = data.people.find(x => x.id === it.pid);
        return `<div class="plan-item">
          <div class="plan-head">${avatarHTML(p, "mini")}<select data-plan-pid="${i}">${options(it.pid)}</select>
            <small class="hint">por: ${esc(it.matches.join(", "))}</small>
            <button type="button" class="icon-btn danger" data-plan-del="${i}" title="Quitar">✕</button></div>
          <ul>${it.tasks.map((t, j) => `<li><input type="text" value="${esc(t)}" data-plan-task="${i}:${j}"></li>`).join("")}</ul>
        </div>`; }).join("")}</div>
      <div class="ceo-actions"><button type="button" class="primary-btn" id="ceoConfirmBtn">✅ Confirmar reparto</button>
        <button type="button" class="link-btn" id="ceoCancelBtn">Cancelar</button></div>`;
    box.querySelectorAll("[data-plan-pid]").forEach(sel => sel.addEventListener("change", () => { pendingPlan.items[+sel.dataset.planPid].pid = sel.value; }));
    box.querySelectorAll("[data-plan-task]").forEach(inp => inp.addEventListener("input", () => { const [i, j] = inp.dataset.planTask.split(":").map(Number); pendingPlan.items[i].tasks[j] = inp.value; }));
    box.querySelectorAll("[data-plan-del]").forEach(b => b.addEventListener("click", () => { pendingPlan.items.splice(+b.dataset.planDel, 1); if (!pendingPlan.items.length) pendingPlan = null; renderPlan(); }));
    // Si se cambia el responsable, se fusionan filas duplicadas al confirmar
    $("#ceoConfirmBtn").addEventListener("click", () => {
      confirmPlan(pendingPlan.items.map(it => ({ person: data.people.find(x => x.id === it.pid), tasks: it.tasks.filter(t => t.trim()) })), pendingPlan.request);
    });
    $("#ceoCancelBtn").addEventListener("click", () => { pendingPlan = null; renderPlan(); });
  }
  function confirmPlan(items, request) {
    const boss = ceo();
    const assigned = [];
    const merged = [];
    items.forEach(({ person, tasks }) => { if (!person) return; const m = merged.find(x => x.person === person); if (m) m.tasks.push(...tasks); else merged.push({ person, tasks: [...tasks] }); });
    merged.forEach(({ person, tasks }) => {
      if (!person || !tasks.length) return;
      if (!Array.isArray(person.tasks)) person.tasks = [];
      tasks.forEach(text => person.tasks.push({ id: uid(), text, done: false }));
      assigned.push(person);
      logEvent(person === boss ? `📌 <b>${esc(boss.name)}</b> se queda: ${esc(tasks.length === 1 ? tasks[0] : tasks.length + " tareas")}` : `📌 <b>${esc(boss.name)}</b> asigna a <b>${esc(person.name)}</b>: ${esc(tasks.length === 1 ? tasks[0] : tasks.length + " tareas")}`);
    });
    if (!Array.isArray(data.requests)) data.requests = [];
    data.requests.unshift({ id: uid(), text: request, at: new Date().toISOString(), to: assigned.map(p => p.id) });
    data.requests.length = Math.min(data.requests.length, 50);
    persist();
    pendingPlan = null;
    $("#ceoPlan").innerHTML = `<p class="ceo-reply">✅ <b>${esc(boss.name)}</b>: hecho. ${assigned.length ? "Reparto entregado a " + assigned.map(p => esc(p.name)).join(", ") + "." : ""}</p>`;
    $("#ceoInput").value = "";
    if (assigned.length) {
      const pids = [boss.id, ...assigned.filter(p => p !== boss).map(p => p.id)];
      if (pids.length >= 2) startMeeting(pids, `${boss.name} reparte: ${shortText(request)}`);
    }
    renderFloor();
    if (currentTab === "team") renderTeam();
  }

  // ---------- Cerebro de cada trabajador ----------
  let brainPid = null, recognition = null, dictating = false;
  const KTYPE = { nota: "📝 Nota", audio: "🎙️ Dictado", archivo: "📄 Archivo", enlace: "🔗 Enlace" };

  function openBrain(pid) {
    const p = data.people.find(x => x.id === pid);
    if (!p) return;
    brainPid = pid;
    stopDictation();
    $("#brainNote").value = "";
    $("#brainLink").value = "";
    $("#brainTranscript").textContent = "";
    renderBrain();
    $("#brainOverlay").classList.add("open");
  }
  function closeBrain() { stopDictation(); $("#brainOverlay").classList.remove("open"); brainPid = null; }
  function brainPerson() { return data.people.find(x => x.id === brainPid); }

  function renderBrain() {
    const p = brainPerson();
    if (!p) return;
    const d = deptById(p.deptId);
    $("#brainTitle").innerHTML = `${avatarHTML(p, "mini")} <span>🧠 Cerebro de ${esc(p.name)} <small class="hint">${esc(p.role)} · ${d ? esc(d.emoji + " " + d.name) : ""}</small></span>`;
    $("#brainSkills").innerHTML = skillsOf(p).map(k => `<span class="skill-chip">${esc(k)}</span>`).join("") || '<span class="hint">Sin conocimientos registrados. Añádelos en «Editar ficha».</span>';
    $("#brainTasks").innerHTML = tasksOf(p).map(t => `<li class="${t.done ? "done" : ""}"><label><input type="checkbox" data-brain-task="${t.id}" ${t.done ? "checked" : ""}> ${esc(t.text)}</label></li>`).join("") || '<li class="hint">Sin tareas.</li>';
    const items = p.knowledge || [];
    $("#brainCount").textContent = items.length ? `${items.length} ${items.length === 1 ? "elemento" : "elementos"} · ${fmtSize(JSON.stringify(items).length)}` : "Vacío";
    $("#brainList").innerHTML = items.slice().reverse().map(k => `
      <details class="knowledge-item" data-kid="${k.id}">
        <summary><span class="ktype">${KTYPE[k.type] || "📝"}</span> <strong>${esc(k.title)}</strong>
          <small class="hint">${new Date(k.createdAt).toLocaleDateString("es")} · ${fmtSize((k.content || "").length)}</small>
          <button type="button" class="icon-btn danger" data-del-knowledge="${k.id}" title="Eliminar">✕</button></summary>
        ${k.type === "enlace" ? `<a href="${esc(k.content)}" target="_blank" rel="noopener">${esc(k.content)}</a>` : `<pre>${esc(k.content)}</pre>`}
      </details>`).join("") || '<p class="hint">Todavía no le has dado ningún conocimiento. Escríbelo, díctalo, sube un archivo o pega un enlace.</p>';
  }
  function fmtSize(n) { return n < 1024 ? `${n} car.` : `${(n / 1024).toFixed(1)} KB`; }

  function addKnowledge(type, title, content) {
    const p = brainPerson();
    if (!p || !content.trim()) return;
    if (!Array.isArray(p.knowledge)) p.knowledge = [];
    p.knowledge.push({ id: uid(), type, title: title.trim() || KTYPE[type], content: content.trim(), createdAt: new Date().toISOString() });
    try { persist(); } catch (e) { p.knowledge.pop(); alert("No cabe más conocimiento en el almacenamiento del navegador. Elimina algún elemento grande."); return; }
    logEvent(`🧠 <b>${esc(p.name)}</b> aprende: ${esc(title || KTYPE[type])}`);
    renderBrain();
    if (currentTab === "team") renderTeam();
  }

  // Dictado por voz con el reconocimiento del navegador (Chrome, Edge, Safari)
  function startDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { $("#brainTranscript").textContent = "Tu navegador no permite dictar. Usa Chrome o Edge, o escribe el texto."; return; }
    recognition = new SR();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    let finalText = $("#brainTranscript").dataset.final || "";
    recognition.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interim += r[0].transcript;
      }
      $("#brainTranscript").dataset.final = finalText;
      $("#brainTranscript").innerHTML = `${esc(finalText)}<span class="interim">${esc(interim)}</span>`;
    };
    recognition.onerror = e => { $("#brainTranscript").textContent = e.error === "not-allowed" ? "Permiso de micrófono denegado. Actívalo en el candado de la barra de direcciones." : `Error de dictado: ${e.error}`; stopDictation(); };
    recognition.onend = () => { if (dictating) { try { recognition.start(); } catch (_) {} } };
    recognition.start();
    dictating = true;
    $("#brainDictateBtn").textContent = "⏹️ Parar";
    $("#brainDictateBtn").classList.add("recording");
  }
  function stopDictation() {
    dictating = false;
    if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
    const b = $("#brainDictateBtn");
    if (b) { b.textContent = "🎙️ Dictar"; b.classList.remove("recording"); }
  }

  // Exportación: prompt de agente y SKILL.md
  function agentPrompt(p) {
    const d = deptById(p.deptId);
    const lines = [
      `# ${p.name} — ${p.role}`,
      `Departamento: ${d ? d.name : "—"}. Eres ${p.name}, ${p.role.toLowerCase()} en una agencia de contenido. Actúa siempre desde ese rol.`,
      "",
      "## Conocimientos",
      ...(skillsOf(p).length ? skillsOf(p).map(k => `- ${k}`) : ["- (sin conocimientos registrados)"]),
      "",
      "## Tareas actuales",
      ...(tasksOf(p).length ? tasksOf(p).map(t => `- [${t.done ? "x" : " "}] ${t.text}`) : ["- (sin tareas)"]),
      "",
      "## Base de conocimiento",
    ];
    const items = p.knowledge || [];
    if (!items.length) lines.push("(vacía)");
    items.forEach(k => { lines.push(`### ${k.title} (${KTYPE[k.type] || k.type})`, k.content, ""); });
    return lines.join("\n");
  }
  function skillMd(p) {
    const slug = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    return `---\nname: ${slug}\ndescription: ${p.role}. Usa esta skill cuando haga falta el trabajo de ${p.name}: ${skillsOf(p).slice(0, 4).join(", ") || p.role}.\n---\n\n${agentPrompt(p)}\n`;
  }
  function download(name, text) {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function initBrain() {
    $("#brainCloseBtn").addEventListener("click", closeBrain);
    $("#brainOverlay").addEventListener("click", e => { if (e.target === $("#brainOverlay")) closeBrain(); });
    $("#brainNoteForm").addEventListener("submit", e => {
      e.preventDefault();
      addKnowledge("nota", $("#brainNoteTitle").value, $("#brainNote").value);
      $("#brainNoteTitle").value = ""; $("#brainNote").value = "";
    });
    $("#brainLinkForm").addEventListener("submit", e => {
      e.preventDefault();
      const url = $("#brainLink").value.trim();
      if (!url) return;
      addKnowledge("enlace", $("#brainLinkTitle").value || url.replace(/^https?:\/\//, "").slice(0, 60), url);
      $("#brainLinkTitle").value = ""; $("#brainLink").value = "";
    });
    $("#brainFile").addEventListener("change", e => {
      [...e.target.files].forEach(file => {
        if (file.size > 400 * 1024) { alert(`${file.name} es demasiado grande (máx. 400 KB).`); return; }
        const reader = new FileReader();
        reader.onload = () => addKnowledge("archivo", file.name, String(reader.result));
        reader.readAsText(file);
      });
      e.target.value = "";
    });
    $("#brainDictateBtn").addEventListener("click", () => { if (dictating) stopDictation(); else startDictation(); });
    $("#brainSaveDictationBtn").addEventListener("click", () => {
      stopDictation();
      const text = ($("#brainTranscript").dataset.final || "").trim();
      if (!text) { $("#brainTranscript").textContent = "No hay nada dictado todavía."; return; }
      addKnowledge("audio", $("#brainDictationTitle").value || "Dictado " + new Date().toLocaleString("es"), text);
      $("#brainTranscript").textContent = ""; $("#brainTranscript").dataset.final = ""; $("#brainDictationTitle").value = "";
    });
    $("#brainClearDictationBtn").addEventListener("click", () => { stopDictation(); $("#brainTranscript").textContent = ""; $("#brainTranscript").dataset.final = ""; });
    $("#brainList").addEventListener("click", e => {
      const del = e.target.closest("[data-del-knowledge]");
      if (!del) return;
      e.preventDefault();
      const p = brainPerson();
      confirmAction("¿Eliminar este conocimiento?", () => { p.knowledge = p.knowledge.filter(k => k.id !== del.dataset.delKnowledge); persist(); renderBrain(); if (currentTab === "team") renderTeam(); });
    });
    $("#brainTasks").addEventListener("change", e => {
      const cb = e.target.closest("[data-brain-task]");
      const p = brainPerson();
      const t = p && tasksOf(p).find(t => t.id === cb.dataset.brainTask);
      if (!t) return;
      t.done = cb.checked; persist(); renderBrain();
      if (t.done) logEvent(`✅ <b>${esc(p.name)}</b> termina: ${esc(t.text)}`);
      if (currentTab === "team") renderTeam();
    });
    $("#brainCopyBtn").addEventListener("click", async () => {
      const p = brainPerson();
      try { await navigator.clipboard.writeText(agentPrompt(p)); $("#brainCopyBtn").textContent = "✅ Copiado"; setTimeout(() => $("#brainCopyBtn").textContent = "📋 Copiar prompt del agente", 1800); }
      catch (_) { download(`${p.name}-prompt.md`, agentPrompt(p)); }
    });
    $("#brainSkillBtn").addEventListener("click", () => { const p = brainPerson(); download(`SKILL-${p.name}.md`, skillMd(p)); });
    $("#brainEditBtn").addEventListener("click", () => {
      const pid = brainPid; closeBrain();
      document.querySelector('[data-office-tab="team"]').click();
      const b = document.querySelector(`[data-edit-person="${pid}"]`); if (b) b.click();
    });
  }

  function init() {
    const root = $("#module-office");
    if (!root) return;
    initBrain();

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
    $("#ceoForm").addEventListener("submit", e => {
      e.preventDefault();
      const text = $("#ceoInput").value.trim();
      if (!text) return;
      logEvent(`🗣️ <b>Tú</b> → <b>${esc(ceo().name)}</b>: ${esc(shortText(text))}`);
      askCeo(text);
    });
    $("#officeAllWorkBtn").addEventListener("click", () => {
      currentMeeting = null;
      data.people.forEach(p => { p.status = "working"; });
      persist(); logEvent("📢 ¡Todo el mundo a su puesto!"); renderFloor();
    });
    $("#officeMeetingBtn").addEventListener("click", () => {
      startMeeting(data.people.map(p => p.id), "Reunión general del equipo");
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
      const brainBtn = e.target.closest("[data-open-brain]");
      if (brainBtn) { closePopover(); openBrain(brainBtn.dataset.openBrain); return; }
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
      const person = e.target.closest(".person[data-pid]");
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
      if (t.dataset.openBrain) { openBrain(t.dataset.openBrain); return; }
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
