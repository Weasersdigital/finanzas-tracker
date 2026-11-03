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
      ["Hugo", "Agente de onboarding de clientes", 2, "bald", "Onboarding de clientes, Grupos de WhatsApp, Contratos, HeyGen (app, afiliado y clones), Comunidad Skool, Drive, Llamada de onboarding", "Preparar el onboarding del próximo cliente (pídeselo al CEO con su nombre)", ONBOARDING_PROCESS],
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
    p.tasks.forEach(t => { if (!t.createdAt) t.createdAt = new Date().toISOString(); if (!Array.isArray(t.blockedBy)) t.blockedBy = []; });
  });
  function persist() { localStorage.setItem(KEY, JSON.stringify(data)); }
  persist();

  const deptById = id => data.departments.find(d => d.id === id);
  const skillsOf = p => Array.isArray(p.skills) ? p.skills : [];
  const tasksOf = p => Array.isArray(p.tasks) ? p.tasks : [];
  function taskIndex() {
    const idx = new Map();
    data.people.forEach(p => tasksOf(p).forEach(t => idx.set(t.id, { task: t, person: p })));
    return idx;
  }
  function blockers(t, idx) {
    idx = idx || taskIndex();
    return (t.blockedBy || []).map(id => idx.get(id)).filter(x => x && !x.task.done);
  }
  const isBlocked = (t, idx) => blockers(t, idx).length > 0;
  const activeTasks = p => { const idx = taskIndex(); return tasksOf(p).filter(t => !t.done && !isBlocked(t, idx)); };
  const currentTask = p => activeTasks(p)[0] || null;
  const daysSince = iso => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  function taskClient(t) { const m = (t.text || "").match(/^\[Onboarding\s+([^\]]+)\]/i); return t.client || (m ? m[1] : null); }
  function taskLi(t, p, attr, idx) {
    const bl = blockers(t, idx);
    const days = !t.done && !bl.length ? daysSince(t.createdAt) : 0;
    return `<li class="${t.done ? "done" : bl.length ? "blocked" : ""}">
      <label><input type="checkbox" ${attr}="${t.id}" ${t.done ? "checked" : ""} ${bl.length ? "disabled" : ""}> ${esc(t.text)}</label>
      ${bl.length ? `<small class="hint">🔒 esperando a ${esc(bl.map(b => b.person.name).filter((v, i, a) => a.indexOf(v) === i).join(", "))}</small>` : ""}
      ${days >= 2 ? `<small class="late">⏳ ${days} días</small>` : ""}
      ${t.output ? `<small class="hint">📎 entregado</small>` : ""}
      ${!t.done ? `<button type="button" class="link-btn work-btn" data-work="${p.id}:${t.id}">▶ Trabajar</button>` : `<button type="button" class="link-btn work-btn" data-work="${p.id}:${t.id}">ver</button>`}
    </li>`;
  }
  function completeTask(p, t, done) {
    t.done = done;
    t.doneAt = done ? new Date().toISOString() : null;
    persist();
    if (done) {
      logEvent(`✅ <b>${esc(p.name)}</b> termina: ${esc(t.text)}`);
      // Desbloquea lo que dependía de esta tarea
      const idx = taskIndex();
      data.people.forEach(q => tasksOf(q).forEach(u => {
        if (u.done || !(u.blockedBy || []).includes(t.id) || isBlocked(u, idx)) return;
        if (q === ceo()) { logEvent(`📣 <b>Te toca</b>: ${esc(u.text)}`); notify(`📣 Te toca: ${u.text}`); }
        else logEvent(`🔓 Ahora le toca a <b>${esc(q.name)}</b>: ${esc(u.text)}`);
      }));
    }
    renderFloor();
    renderInbox();
    if (currentTab === "team") renderTeam();
  }
  function notify(msg) {
    const el = $("#officeToast");
    if (!el) return;
    el.textContent = msg; el.classList.add("show");
    clearTimeout(notify.t); notify.t = setTimeout(() => el.classList.remove("show"), 4000);
  }
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
  let popAnchor = null;
  function openPopover(pid, anchor) {
    const p = data.people.find(x => x.id === pid);
    if (!p) return;
    popAnchor = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    anchor = popAnchor;
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
        <ul class="task-list">${(idx => tasksOf(p).map(t => taskLi(t, p, "data-task", idx)).join(""))(taskIndex()) || '<li class="hint">Ninguna todavía</li>'}</ul>
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
      const pending = tasksOf(p).filter(t => !t.done).length, total = tasksOf(p).length, blocked = tasksOf(p).filter(t => !t.done && isBlocked(t)).length;
      return `<div class="list-row person-row">${avatarHTML(p, "mini")}
        <span class="grow"><strong>${esc(p.name)}</strong> <small class="hint">${esc(p.role)} · ${d ? esc(d.emoji + " " + d.name) : "—"}</small>
          <span class="skills-line">${skillsOf(p).map(k => `<span class="skill-chip">${esc(k)}</span>`).join("") || '<span class="hint">Sin conocimientos registrados</span>'}</span>
          ${total ? `<small class="hint">📋 ${pending} de ${total} pendientes${blocked ? ` (${blocked} en espera)` : ""}${currentTask(p) ? ` · ahora: ${esc(currentTask(p).text)}` : ""}</small>` : '<small class="hint">📋 Sin tareas</small>'}
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
    const add = (person, task, matches, why, client) => {
      let it = items.find(x => x.pid === person.id);
      if (!it) { it = { pid: person.id, tasks: [], matches: [], why }; items.push(it); }
      if (!it.tasks.some(t => t.text === task)) it.tasks.push({ text: task, kind: matches[0] || "otro", client: client || null });
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
            if (steps.length) steps.forEach(st => add(best.p, `${tag} ${st.trim()}`, ["onboarding"], "onboarding", n || null));
            else add(best.p, n ? `Onboarding de ${n}` : text, ["onboarding"], "onboarding", n || null);
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
        add(x.w.p, task, x.matches.includes("publicar") ? ["publicar", ...x.matches.filter(m => m !== "publicar")] : x.matches, x.matches.join(", "));
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
          <ul>${it.tasks.map((t, j) => `<li><input type="text" value="${esc(t.text)}" data-plan-task="${i}:${j}"></li>`).join("")}</ul>
        </div>`; }).join("")}</div>
      <div class="ceo-actions"><button type="button" class="primary-btn" id="ceoConfirmBtn">✅ Confirmar reparto</button>
        <button type="button" class="link-btn" id="ceoCancelBtn">Cancelar</button></div>`;
    box.querySelectorAll("[data-plan-pid]").forEach(sel => sel.addEventListener("change", () => { pendingPlan.items[+sel.dataset.planPid].pid = sel.value; }));
    box.querySelectorAll("[data-plan-task]").forEach(inp => inp.addEventListener("input", () => { const [i, j] = inp.dataset.planTask.split(":").map(Number); pendingPlan.items[i].tasks[j].text = inp.value; }));
    box.querySelectorAll("[data-plan-del]").forEach(b => b.addEventListener("click", () => { pendingPlan.items.splice(+b.dataset.planDel, 1); if (!pendingPlan.items.length) pendingPlan = null; renderPlan(); }));
    // Si se cambia el responsable, se fusionan filas duplicadas al confirmar
    $("#ceoConfirmBtn").addEventListener("click", () => {
      confirmPlan(pendingPlan.items.map(it => ({ person: data.people.find(x => x.id === it.pid), tasks: it.tasks.filter(t => t.text.trim()) })), pendingPlan.request);
    });
    $("#ceoCancelBtn").addEventListener("click", () => { pendingPlan = null; renderPlan(); });
  }
  function confirmPlan(items, request) {
    const boss = ceo();
    const assigned = [];
    const merged = [];
    items.forEach(({ person, tasks }) => { if (!person) return; const m = merged.find(x => x.person === person); if (m) m.tasks.push(...tasks); else merged.push({ person, tasks: [...tasks] }); });
    const requestId = uid(), created = [];
    merged.forEach(({ person, tasks }) => {
      if (!person || !tasks.length) return;
      if (!Array.isArray(person.tasks)) person.tasks = [];
      tasks.forEach(t => {
        const task = { id: uid(), text: t.text, kind: t.kind || "otro", client: t.client || null, done: false, createdAt: new Date().toISOString(), blockedBy: [], requestId };
        person.tasks.push(task); created.push({ task, person });
      });
      assigned.push(person);
      logEvent(person === boss ? `📌 <b>${esc(boss.name)}</b> se queda: ${esc(tasks.length === 1 ? tasks[0].text : tasks.length + " tareas")}` : `📌 <b>${esc(boss.name)}</b> asigna a <b>${esc(person.name)}</b>: ${esc(tasks.length === 1 ? tasks[0].text : tasks.length + " tareas")}`);
    });
    // Encadenado: producción → revisión del CEO → publicación
    const prod = created.filter(c => c.task.kind !== "revision" && c.task.kind !== "publicar");
    const rev = created.filter(c => c.task.kind === "revision");
    const pub = created.filter(c => c.task.kind === "publicar");
    rev.forEach(c => { c.task.blockedBy = prod.map(x => x.task.id); });
    pub.forEach(c => { c.task.blockedBy = (rev.length ? rev : prod).map(x => x.task.id); });
    if (rev.length && prod.length) logEvent(`🔗 La revisión de <b>${esc(boss.name)}</b> espera a ${prod.length} tareas; la publicación, a la revisión.`);
    if (!Array.isArray(data.requests)) data.requests = [];
    data.requests.unshift({ id: requestId, text: request, at: new Date().toISOString(), to: assigned.map(p => p.id) });
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
    renderInbox();
    if (currentTab === "team") renderTeam();
  }

  // ---------- Bandeja del jefe: lo que te toca a ti y lo que lleva días parado ----------
  function renderInbox() {
    const el = $("#officeInbox");
    if (!el) return;
    const boss = ceo();
    const idx = taskIndex();
    const mine = boss ? tasksOf(boss).filter(t => !t.done && !isBlocked(t, idx)) : [];
    const late = [];
    data.people.forEach(p => tasksOf(p).forEach(t => { if (!t.done && !isBlocked(t, idx) && daysSince(t.createdAt) >= 2 && p !== boss) late.push({ t, p }); }));
    late.sort((a, b) => daysSince(b.t.createdAt) - daysSince(a.t.createdAt));
    const waiting = [];
    data.people.forEach(p => tasksOf(p).forEach(t => { if (!t.done && isBlocked(t, idx)) waiting.push({ t, p }); }));
    if (!mine.length && !late.length && !waiting.length) { el.style.display = "none"; return; }
    el.style.display = "";
    el.innerHTML = `
      ${mine.length ? `<h4>📣 Te toca a ti (${mine.length})</h4><ul class="task-list">${mine.map(t => taskLi(t, boss, "data-task-inbox", idx)).join("")}</ul>` : ""}
      ${late.length ? `<h4>⏳ Lleva días parado</h4><ul class="task-list">${late.slice(0, 6).map(({ t, p }) => `<li><span><b>${esc(p.name)}</b>: ${esc(t.text)} <small class="late">${daysSince(t.createdAt)} días</small></span> <button type="button" class="link-btn work-btn" data-work="${p.id}:${t.id}">▶ Trabajar</button></li>`).join("")}</ul>` : ""}
      ${waiting.length ? `<details><summary class="hint">🔒 ${waiting.length} tareas en espera de otras</summary><ul class="task-list">${waiting.map(({ t, p }) => `<li><span><b>${esc(p.name)}</b>: ${esc(t.text)}</span> <small class="hint">esperando a ${esc(blockers(t, idx).map(b => b.person.name).filter((v, i, a) => a.indexOf(v) === i).join(", "))}</small></li>`).join("")}</ul></details>` : ""}`;
  }

  // ---------- Mesa de trabajo: cada trabajador prepara su tarea ----------
  const DEFAULT_TEMPLATES = {
    bienvenida: "Hola {cliente}, ¡bienvenido/a! Soy {yo}, del equipo de {ceo}. A partir de ahora me encargo de que tu arranque sea fácil. En los próximos días te iré pasando todo lo que necesitamos. Cualquier duda, por aquí.",
    "documento de onboarding": "Hola {cliente}, aquí tienes el documento de onboarding: {link}\nCuando lo tengas rellenado, avísame y fijamos la llamada de onboarding.",
    contrato: "Hola {cliente}, te paso el contrato para firmar: {link}\nEn cuanto esté firmado seguimos con el resto.",
    heygen: "Hola {cliente}, para los clones necesitamos que te descargues la app de HeyGen. Este es el enlace: {link}\nCrea la cuenta con ese enlace y me dices cuando la tengas.",
    skool: "Hola {cliente}, ya tienes acceso a la comunidad: {link}\nEntra y preséntate cuando quieras.",
    grupo: "Creo este grupo para coordinar la grabación y el contenido de {cliente}. Estamos {ceo}, Javi (cámara) y yo. Próximo paso: definir dónde y cuándo grabamos los clones.",
    llamada: "Hola {cliente}, ya tenemos tu onboarding rellenado. ¿Qué día te viene bien para la llamada de onboarding (30 min)? Te paso opciones: ...",
    dm: "¡Hola! Gracias por escribir 🙌 Cuéntame un poco qué estás buscando y te digo cómo podemos ayudarte.",
    revision: "Ya está todo listo para tu revisión. Cuando des el OK, se publica.",
  };
  const DRIVE_FOLDERS = ["01 Onboarding", "02 Material en bruto", "03 Vídeos largos", "04 Clips", "05 Reels", "06 Miniaturas", "07 Guiones", "08 Publicado"];

  function fill(tpl, ctx) { return tpl.replace(/\{(\w+)\}/g, (_, k) => ctx[k] != null ? ctx[k] : `{${k}}`); }
  function brainTemplate(p, key) {
    const k = tokens(key);
    const note = (p.knowledge || []).filter(x => x.type !== "enlace" && /^plantilla/i.test(x.title)).map(x => ({ x, score: [...tokens(x.title.replace(/^plantilla:?/i, ""))].filter(t => k.has(t)).length })).filter(x => x.score > 0).sort((a, b) => b.score - a.score)[0];
    return note ? note.x.content : null;
  }
  function brainLink(p, words) {
    const k = tokens(words);
    const best = (p.knowledge || []).filter(x => x.type === "enlace").map(x => ({ x, score: [...tokens(x.title)].filter(t => k.has(t)).length })).filter(x => x.score > 0).sort((a, b) => b.score - a.score)[0];
    return best ? best.x.content : null;
  }
  function financeReport() {
    const load = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (_) { return []; } };
    const tx = load("ft_transactions"), rec = load("ft_recurring");
    const month = new Date().toISOString().slice(0, 7);
    const inMonth = tx.filter(t => (t.date || "").slice(0, 7) === month);
    const sum = (arr, type, scope) => arr.filter(t => t.type === type && (!scope || t.scope === scope)).reduce((a, t) => a + Number(t.amount || 0), 0);
    const fmt = n => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
    const pendingFixed = rec.filter(r => !tx.some(t => t.recurringId === r.id && (t.date || "").slice(0, 7) === month));
    const lines = [
      `Informe de ${month}`,
      `Empresa: ingresos ${fmt(sum(inMonth, "income", "empresa"))} · gastos ${fmt(sum(inMonth, "expense", "empresa"))} · balance ${fmt(sum(inMonth, "income", "empresa") - sum(inMonth, "expense", "empresa"))}`,
      `Personal: ingresos ${fmt(sum(inMonth, "income", "personal"))} · gastos ${fmt(sum(inMonth, "expense", "personal"))}`,
      `Movimientos del mes: ${inMonth.length}`,
      pendingFixed.length ? `Gastos fijos sin registrar este mes: ${pendingFixed.map(r => `${r.name} (${fmt(Number(r.amount))})`).join(", ")}` : "Todos los gastos fijos del mes están registrados.",
    ];
    return { text: lines.join("\n"), pendingFixed };
  }

  // Devuelve { actions:[{label, href}], messages:[{title, text}], notes:[string], checklist:[string] }
  function prepareTask(p, t) {
    const boss = ceo();
    const ctx = { cliente: taskClient(t) || "{cliente}", yo: p.name, ceo: boss ? boss.name : "" };
    const txt = (t.text || "").toLowerCase();
    const has = re => re.test(txt);
    const out = { actions: [], messages: [], notes: [], checklist: [] };
    const msg = (title, key, link) => { const tpl = brainTemplate(p, key) || DEFAULT_TEMPLATES[key]; if (tpl) out.messages.push({ title, text: fill(tpl, Object.assign({ link: link || "{enlace}" }, ctx)) }); };
    const needLink = (what, words) => { const l = brainLink(p, words); if (l) out.actions.push({ label: `🔗 Abrir ${what}`, href: l }); else out.notes.push(`Falta el enlace de «${what}». Añádelo en el cerebro de ${p.name} como enlace con ese título y lo usaré aquí.`); return l; };

    if (has(/whatsapp|grupo/)) { out.actions.push({ label: "💬 Abrir WhatsApp Web", href: "https://web.whatsapp.com/" }); msg("Primer mensaje del grupo", "grupo"); out.checklist.push(`Crear el grupo «${ctx.cliente} × ${ctx.ceo}» con ${ctx.ceo}, el cliente y Javi`, "Pegar el primer mensaje"); }
    if (has(/documento de onboarding|cuestionario/)) { const l = needLink("documento de onboarding", "documento onboarding cuestionario formulario"); msg("Mensaje para enviar el documento", "documento de onboarding", l); }
    if (has(/contrato/)) { const l = needLink("contrato", "contrato firma"); msg("Mensaje con el contrato", "contrato", l); }
    if (has(/heygen/) && !has(/clones de inteligencia|importar/)) { const l = needLink("HeyGen (enlace de afiliado)", "heygen afiliado app"); msg("Mensaje de HeyGen", "heygen", l); }
    if (has(/skool|comunidad/)) { const l = needLink("comunidad de Skool", "skool comunidad"); out.actions.push({ label: "👥 Abrir Skool", href: l || "https://www.skool.com/" }); msg("Mensaje de acceso a la comunidad", "skool", l); }
    if (has(/llamada|kickoff|reuni[oó]n con/)) {
      const title = encodeURIComponent(`Llamada de onboarding · ${ctx.cliente}`), details = encodeURIComponent(`Onboarding de ${ctx.cliente}. Repasar documento de onboarding, grabación de clones y calendario de contenidos.`);
      out.actions.push({ label: "📅 Crear la llamada en Google Calendar", href: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}` });
      msg("Mensaje para fijar la llamada", "llamada");
      out.checklist.push("Confirmar que el documento de onboarding está rellenado antes de fijarla");
    }
    if (has(/drive|carpeta/)) { const l = brainLink(p, "drive clientes carpeta"); out.actions.push({ label: "📁 Abrir Google Drive", href: l || "https://drive.google.com/drive/my-drive" }); out.messages.push({ title: `Estructura de carpetas para ${ctx.cliente}`, text: `${ctx.cliente}/\n` + DRIVE_FOLDERS.map(f => `  ${f}/`).join("\n") }); out.checklist.push(`Crear la carpeta «${ctx.cliente}» y las subcarpetas`, "Compartirla con el cliente y con Contenido"); }
    if (has(/ubicaci[oó]n|grabaci[oó]n/) && !has(/importar/)) { out.checklist.push("Preguntar al cliente ciudad y disponibilidad", "Confirmar fecha y lugar con Javi (cámara)", "Apuntarlo en el grupo de WhatsApp"); out.actions.push({ label: "📅 Reservar la grabación en Calendar", href: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent("Grabación de clones · " + ctx.cliente)}` }); }
    if (has(/clones de inteligencia|importar/)) { out.actions.push({ label: "🎭 Abrir HeyGen", href: "https://app.heygen.com/" }); out.checklist.push("Subir el vídeo de la grabación", "Crear el avatar (clon) y la voz", "Hacer un vídeo de prueba y validarlo con el cliente"); }
    if (has(/bienvenida/) || (t.kind === "onboarding" && !out.messages.length && !out.checklist.length)) msg("Mensaje de bienvenida", "bienvenida");
    if (t.kind === "dm" || has(/\bdm|mensajes|instagram/)) { out.actions.push({ label: "📩 Abrir bandeja de Instagram", href: "https://www.instagram.com/direct/inbox/" }); msg("Respuesta tipo", "dm"); (p.knowledge || []).filter(x => /^plantilla/i.test(x.title) && x.type !== "enlace").forEach(x => { if (!out.messages.some(m => m.text === x.content)) out.messages.push({ title: x.title.replace(/^plantilla:?\s*/i, ""), text: x.content }); }); }
    if (t.kind === "publicar" || has(/publicar|programar|subir/)) { out.actions.push({ label: "▶️ Abrir YouTube Studio", href: "https://studio.youtube.com/" }, { label: "📱 Abrir Instagram", href: "https://www.instagram.com/" }); out.checklist.push("Título (máx. 60 caracteres)", "Descripción con capítulos y enlaces", "Miniatura subida", "Etiquetas y categoría", "Programar fecha y hora", "Avisar a " + ctx.ceo); }
    if (t.kind === "titulo" || has(/t[ií]tulo/)) { out.checklist.push("3 opciones de título (curiosidad, beneficio, número)", "Descripción de 2–3 líneas con la promesa del vídeo"); out.messages.push({ title: "Plantilla de título y descripción", text: "Título A: …\nTítulo B: …\nTítulo C: …\n\nDescripción:\n…\n\nCapítulos:\n00:00 Intro\n" }); }
    if (t.kind === "miniatura" || has(/miniatura/)) { out.checklist.push("3 variantes (cara + 3 palabras máx.)", "Exportar 1280×720, < 2 MB", "Subir a Drive › 06 Miniaturas y pegar el enlace como entregable"); out.actions.push({ label: "📁 Abrir Drive", href: brainLink(p, "drive") || "https://drive.google.com/drive/my-drive" }); }
    if (t.kind === "edicion" || t.kind === "youtube" || has(/editar|montar/)) { out.checklist.push("Descargar el bruto de Drive › 02 Material en bruto", "Montaje, modos de cámara/pantalla y animaciones", "Subtítulos y máster para YouTube", "Subir a Drive › 03 Vídeos largos y pegar el enlace como entregable"); out.actions.push({ label: "📁 Abrir Drive", href: brainLink(p, "drive") || "https://drive.google.com/drive/my-drive" }); }
    if (t.kind === "clips" || has(/clips?|sacar/)) { out.checklist.push("Ver el vídeo largo y marcar los momentos con gancho", "Reencuadrar a 9:16 y subtitular", "Subir a Drive › 04 Clips"); out.actions.push({ label: "📁 Abrir Drive", href: brainLink(p, "drive") || "https://drive.google.com/drive/my-drive" }); }
    if (t.kind === "reels" || t.kind === "guion") { out.checklist.push("Elegir formato (Recrear, Reacción, Doble personaje…)", "Gancho en los 2 primeros segundos", "Guardar en Drive › 07 Guiones o 05 Reels"); }
    if (t.kind === "finanzas" || has(/factura|cobro|balance|cierre|contab|impuesto/)) {
      const r = financeReport();
      out.messages.push({ title: "Informe de Finanzas (datos reales de la app)", text: r.text });
      out.actions.push({ label: "💰 Ir a Finanzas", href: "#finanzas" });
      if (r.pendingFixed.length) out.checklist.push(`Registrar ${r.pendingFixed.length} gastos fijos pendientes en Finanzas › Gastos fijos`);
      if (has(/factura/)) out.checklist.push("Emitir las facturas del mes", "Registrar cada cobro como ingreso de empresa");
    }
    if (t.kind === "revision") { out.checklist.push("Revisar cada entregable (enlaces abajo)", "Si está OK, marcar como hecha: la publicación se desbloquea sola"); const idx = taskIndex(); (t.blockedBy || []).map(id => idx.get(id)).filter(Boolean).forEach(({ task, person }) => { if (task.output) out.actions.push({ label: `📎 ${person.name}: ${task.text.slice(0, 40)}`, href: /^https?:/.test(task.output) ? task.output : null, text: task.output }); else out.notes.push(`${person.name} aún no ha dejado entregable en «${task.text}».`); }); }
    if (!out.actions.length && !out.messages.length && !out.checklist.length) out.notes.push("Esta tarea no tiene automatización: hazla y marca como hecha. Si tiene un proceso fijo, escríbelo en el cerebro de " + p.name + " como nota con pasos numerados y la próxima vez la desgloso.");
    return out;
  }

  let workPid = null, workTid = null;
  function openWork(pid, tid) {
    const p = data.people.find(x => x.id === pid); const t = p && tasksOf(p).find(x => x.id === tid);
    if (!t) return;
    workPid = pid; workTid = tid;
    const prep = prepareTask(p, t);
    const bl = blockers(t);
    const d = deptById(p.deptId);
    $("#workTitle").innerHTML = `${avatarHTML(p, "mini")} <span>${esc(t.text)}<small class="hint">${esc(p.name)} · ${esc(p.role)} · ${d ? esc(d.emoji + " " + d.name) : ""}${taskClient(t) ? " · cliente: " + esc(taskClient(t)) : ""}</small></span>`;
    $("#workBody").innerHTML = `
      ${t.done ? `<p class="ceo-reply">✅ Hecha el ${new Date(t.doneAt || t.createdAt).toLocaleString("es")}.</p>` : bl.length ? `<p class="ceo-reply">🔒 Bloqueada hasta que terminen: ${bl.map(b => `<b>${esc(b.person.name)}</b> (${esc(b.task.text)})`).join(", ")}.</p>` : `<p class="ceo-reply">▶ <b>${esc(p.name)}</b> ha preparado esto para que lo ejecutes en un clic:</p>`}
      ${prep.notes.map(n => `<p class="work-note">⚠️ ${esc(n)}</p>`).join("")}
      ${prep.actions.length ? `<div class="work-actions">${prep.actions.map(a => a.href ? `<a class="secondary-btn" href="${esc(a.href)}" target="_blank" rel="noopener">${esc(a.label)}</a>` : `<span class="secondary-btn" title="${esc(a.text || "")}">${esc(a.label)}: ${esc((a.text || "").slice(0, 60))}</span>`).join("")}</div>` : ""}
      ${prep.checklist.length ? `<h4>Pasos</h4><ul class="work-checklist">${prep.checklist.map((c, i) => `<li><label><input type="checkbox" data-step="${i}" ${(t.steps || [])[i] ? "checked" : ""}> ${esc(c)}</label></li>`).join("")}</ul>` : ""}
      ${prep.messages.map((m, i) => `<div class="work-msg"><div class="work-msg-head"><strong>${esc(m.title)}</strong><button type="button" class="link-btn" data-copy="${i}">📋 Copiar</button></div><textarea data-msg="${i}" rows="${Math.min(8, m.text.split("\n").length + 1)}">${esc(m.text)}</textarea></div>`).join("")}
      <h4>Entregable</h4>
      <div class="work-output"><input type="text" id="workOutput" placeholder="Enlace (Drive, YouTube…) o texto corto con el resultado" value="${esc(t.output || "")}"><button type="button" class="secondary-btn" id="workSaveBtn">💾 Guardar</button></div>
      <div class="ceo-actions">
        ${!t.done && !bl.length ? `<button type="button" class="primary-btn" id="workDoneBtn">✅ Marcar como hecha</button>` : ""}
        ${t.done ? `<button type="button" class="secondary-btn" id="workUndoBtn">↩️ Reabrir</button>` : ""}
        <button type="button" class="link-btn" data-open-brain="${p.id}">🧠 Cerebro de ${esc(p.name)}</button>
      </div>`;
    const body = $("#workBody");
    body.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", async () => { const ta = body.querySelector(`[data-msg="${b.dataset.copy}"]`); try { await navigator.clipboard.writeText(ta.value); b.textContent = "✅ Copiado"; setTimeout(() => b.textContent = "📋 Copiar", 1500); } catch (_) { ta.select(); } }));
    body.querySelectorAll("[data-step]").forEach(cb => cb.addEventListener("change", () => { t.steps = t.steps || []; t.steps[+cb.dataset.step] = cb.checked; persist(); }));
    $("#workSaveBtn").addEventListener("click", () => { t.output = $("#workOutput").value.trim() || null; persist(); logEvent(`📎 <b>${esc(p.name)}</b> entrega: ${esc(t.text)}`); notify("Entregable guardado"); renderInbox(); });
    const dn = $("#workDoneBtn"); if (dn) dn.addEventListener("click", () => { t.output = $("#workOutput").value.trim() || t.output || null; completeTask(p, t, true); closeWork(); });
    const un = $("#workUndoBtn"); if (un) un.addEventListener("click", () => { completeTask(p, t, false); openWork(pid, tid); });
    body.querySelector("[data-open-brain]").addEventListener("click", () => { closeWork(); openBrain(p.id); });
    $("#workOverlay").classList.add("open");
  }
  function closeWork() { $("#workOverlay").classList.remove("open"); workPid = workTid = null; }

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
    $("#brainTasks").innerHTML = (idx => tasksOf(p).map(t => taskLi(t, p, "data-brain-task", idx)).join(""))(taskIndex()) || '<li class="hint">Sin tareas.</li>';
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
      completeTask(p, t, cb.checked); renderBrain();
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
    document.addEventListener("click", e => {
      const w = e.target.closest("[data-work]");
      if (w) { e.preventDefault(); const [pid, tid] = w.dataset.work.split(":"); closePopover(); openWork(pid, tid); return; }
      const link = e.target.closest('a[href="#finanzas"]');
      if (link) { e.preventDefault(); closeWork(); document.querySelector('.module-btn[data-module="finance"]').click(); }
    });
    document.addEventListener("change", e => {
      const cb = e.target.closest("[data-task-inbox]");
      if (!cb) return;
      const boss = ceo(); const t = tasksOf(boss).find(x => x.id === cb.dataset.taskInbox);
      if (t) completeTask(boss, t, cb.checked);
    });
    $("#workCloseBtn").addEventListener("click", closeWork);
    $("#workOverlay").addEventListener("click", e => { if (e.target === $("#workOverlay")) closeWork(); });
    renderInbox();
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
          if (t) { completeTask(p, t, cb.checked); if (popAnchor) openPopover(p.id, popAnchor); }
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
