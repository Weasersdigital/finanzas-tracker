// ---------- Oficina virtual: motor 3D (Three.js) ----------
// Dibuja la oficina como un edificio en corte: planta baja con recepción y
// cafetería, una planta por departamento (cada persona con su despacho) y la
// sala de reuniones en la última planta. Las personas se mueven por su planta
// y usan un ascensor de cristal para cambiar de piso o salir del edificio.
// Expone window.Office3D = { available, mount, unmount, sync, say }.
(function () {
  "use strict";

  const O = { available: () => !!window.THREE };
  window.Office3D = O;
  if (!window.THREE) return;
  const T = THREE;

  // Medidas (metros)
  const FLOOR_H = 3.3;   // altura de cada planta
  const BD = 6.4;        // fondo del edificio (eje z); el frente está abierto
  const CUBE_W = 3.0;    // ancho de cada despacho
  const SHAFT_W = 2.2;   // ancho del hueco del ascensor (a la izquierda)
  const SLAB = 0.25;     // grosor del forjado
  const SPEED = 1.7;     // m/s al caminar
  const LIFT_SPEED = 3.2;// m/s en el ascensor

  let container, renderer, scene, camera, statics, sun, hooks, lastData;
  let rooms = {}, floors = [], slots = {}, B = { w: 14, h: 10, aisleZ: 1.3, backZ: -BD / 2, frontZ: BD / 2 };
  let chars = new Map(), pickables = [], sig = "";
  let hoverPid = null, pointer = { x: 0, y: 0, moved: false, inside: false };
  const cam = { theta: 0.3, phi: 1.32, r: 30, target: new T.Vector3(7, 5, 0) };
  const raycaster = new T.Raycaster(), ndc = new T.Vector2();
  const matCache = new Map();

  // ---------- Utilidades ----------
  const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function mat(color, opts) {
    const k = String(color) + JSON.stringify(opts || {});
    if (!matCache.has(k)) matCache.set(k, new T.MeshLambertMaterial(Object.assign({ color }, opts || {})));
    return matCache.get(k);
  }
  function box(w, h, d, color, x, y, z, parent, opts) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || statics).add(m);
    return m;
  }
  function cyl(rt, rb, h, color, x, y, z, parent, seg) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 20), mat(color));
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || statics).add(m);
    return m;
  }
  function plant(x, y, z, parent) {
    cyl(0.18, 0.14, 0.3, 0xb5651d, x, y + 0.15, z, parent);
    cyl(0.02, 0.32, 0.7, 0x2e8b57, x, y + 0.62, z, parent, 8);
  }
  function tree(x, z, s) {
    s = s || 1;
    cyl(0.12 * s, 0.16 * s, 1.0 * s, 0x8b5a2b, x, 0.5 * s, z);
    cyl(0.05, 0.9 * s, 1.6 * s, 0x2e8b57, x, 1.7 * s, z, null, 10);
  }
  function textSprite(text, o) {
    o = o || {};
    const size = o.size || 30, pad = o.pad || 14;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    const font = `${o.weight || 700} ${size}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const dot = o.dot ? size * 0.7 : 0;
    c.width = Math.ceil(tw + pad * 2 + dot);
    c.height = Math.ceil(size * 1.5);
    ctx.font = font;
    ctx.fillStyle = o.bg || "rgba(255,255,255,0.94)";
    const r = c.height / 2;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(c.width - r, 0); ctx.arc(c.width - r, r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(r, c.height); ctx.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    if (o.dot) { ctx.fillStyle = o.dot; ctx.beginPath(); ctx.arc(pad + dot * 0.35, r, dot * 0.32, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = o.color || "#14161a";
    ctx.textBaseline = "middle";
    ctx.fillText(text, pad + dot, r + 1);
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding; tex.minFilter = T.LinearFilter;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    const h = o.h || 0.42;
    sp.scale.set(h * c.width / c.height, h, 1);
    sp.renderOrder = 10;
    return sp;
  }
  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.map) { o.material.map.dispose(); o.material.dispose(); }
    });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  // ---------- Montaje ----------
  O.mount = function (el, h) {
    hooks = h || {};
    if (container === el) return;
    container = el;
    el.innerHTML = "";
    renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    el.appendChild(renderer.domElement);
    const help = document.createElement("div");
    help.className = "office-3d-help";
    help.textContent = "Arrastra para girar · Rueda o pellizco para zoom · Botón derecho para subir y bajar";
    el.appendChild(help);

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(30, 1, 0.1, 500);
    scene.add(new T.HemisphereLight(0xffffff, 0x6b7280, 1.0));
    sun = new T.DirectionalLight(0xffffff, 0.75);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    statics = new T.Group();
    scene.add(statics);

    bindControls(el);
    new ResizeObserver(resize).observe(el);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (lastData) rebuild(lastData, true); });
    resize();
    requestAnimationFrame(loop);
  };

  O.unmount = function () {
    if (!container) return;
    container.innerHTML = "";
    container = null; renderer.dispose(); renderer = null;
    chars.clear(); sig = "";
  };

  function resize() {
    if (!container || !renderer) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!cam.userZoomed) fitCamera();
  }
  // Distancia a la que cabe el edificio entero en el lienzo
  function fitCamera() {
    if (!camera) return;
    const tanV = Math.tan((camera.fov / 2) * Math.PI / 180);
    const needH = (B.h / 2 + 3) / tanV;
    const needW = (B.w / 2 + 4) / (tanV * camera.aspect);
    cam.r = Math.max(needH, needW) * 1.08;
    cam.target.set(B.w / 2, B.h / 2 - 0.5, 0);
  }

  // ---------- Sincronización con los datos ----------
  O.sync = function (data) {
    lastData = data;
    const s = JSON.stringify([
      data.departments.map(d => [d.id, d.name, d.emoji, d.color]),
      data.people.map(p => [p.id, p.deptId, p.name, p.skin, p.hair, p.shirt, p.hairStyle]),
    ]);
    if (s !== sig) { sig = s; rebuild(data); }
    data.people.forEach(p => {
      const ch = chars.get(p.id);
      if (!ch) return;
      if (ch.status !== p.status) {
        ch.status = p.status;
        ch.visit = null;
        setLabel(ch, p);
        assignDestination(ch);
      }
    });
  };

  // Lista de plantas (de arriba abajo) y enfoque de la cámara en una de ellas
  O.floorsList = () => floors.slice().reverse().map(f => ({ id: f.id, label: f.label }));
  O.focusFloor = function (id) {
    const f = rooms[id];
    if (!f) { cam.userZoomed = false; fitCamera(); return; }
    cam.userZoomed = true;
    cam.target.set(B.w / 2, f.y0 + FLOOR_H / 2, 0);
    cam.phi = 1.4;
    const tanV = Math.tan((camera.fov / 2) * Math.PI / 180);
    cam.r = Math.max((FLOOR_H / 2 + 1.5) / tanV, (B.w / 2 + 1) / (tanV * camera.aspect)) * 1.45;
  };

  O.say = function (pid, text) {
    const ch = chars.get(pid);
    if (!ch || ch.hidden) return;
    if (ch.parts.bubble) { ch.g.remove(ch.parts.bubble); disposeGroup(ch.parts.bubble); }
    const sp = textSprite(text, { size: 30, h: 0.5, bg: isDark() ? "rgba(28,31,38,0.95)" : "rgba(255,255,255,0.96)", color: isDark() ? "#e7e9ee" : "#14161a" });
    sp.position.set(0, 2.85, 0);
    ch.g.add(sp);
    ch.parts.bubble = sp;
    ch.bubbleUntil = performance.now() + 3200;
  };

  // ---------- Distribución del edificio ----------
  function computeLayout(data) {
    rooms = {}; slots = {}; floors = [];
    const maxN = Math.max(2, ...data.departments.map(d => data.people.filter(p => p.deptId === d.id).length));
    B.w = Math.max(13, SHAFT_W + 0.6 + maxN * CUBE_W + 0.6);
    B.backZ = -BD / 2; B.frontZ = BD / 2; B.aisleZ = 1.3;
    B.lobbyX = SHAFT_W + 1.2;      // punto delante del ascensor
    B.exitZ = BD / 2 + 2.4;        // fuera del edificio
    const deskZ = B.backZ + 0.95, seatZ = B.backZ + 1.8, visitZ = B.backZ + 2.7;

    const addFloor = (id, label, color) => {
      const i = floors.length;
      const r = { id, floor: i, y0: i * FLOOR_H, label, color, spots: [], cubicles: [], cooler: { x: SHAFT_W + 1.0, z: B.backZ + 1.2, face: Math.PI } };
      rooms[id] = r; floors.push(r);
      return r;
    };

    // Planta baja: recepción y cafetería
    const lobby = addFloor("lobby", "🏢 Recepción y cafetería", "#d97706");
    lobby.tables = [{ x: B.w - 3.2, z: 0.2 }, { x: B.w - 6.4, z: 0.2 }];
    lobby.tables.forEach(t => {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const x = t.x + Math.cos(a) * 1.0, z = t.z + Math.sin(a) * 1.0;
        lobby.spots.push({ x, z, face: Math.atan2(t.x - x, t.z - z) });
      }
    });
    lobby.spots.push({ x: B.w - 4.0, z: B.backZ + 1.3, face: Math.PI });
    lobby.spots.push({ x: B.w - 5.2, z: B.backZ + 1.3, face: Math.PI });

    // Una planta por departamento
    data.departments.forEach(d => {
      const members = data.people.filter(p => p.deptId === d.id);
      const r = addFloor(d.id, `${d.emoji} ${d.name}`, d.color);
      r.dept = d;
      r.cubicles = members.map((p, j) => ({
        pid: p.id, name: p.name, roomId: d.id,
        x: SHAFT_W + 0.6 + j * CUBE_W + CUBE_W / 2, deskZ, seatZ, visitZ, face: Math.PI,
      }));
    });

    // Última planta: sala de reuniones
    const m = addFloor("meeting", "🗣️ Sala de reuniones", "#7c3aed");
    m.center = { x: SHAFT_W + 0.6 + (B.w - SHAFT_W - 1.2) / 2, z: -0.3 };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const x = m.center.x + Math.cos(a) * 2.6, z = m.center.z + Math.sin(a) * 1.5;
      m.spots.push({ x, z, face: Math.atan2(m.center.x - x, m.center.z - z), seat: true });
    }

    B.h = floors.length * FLOOR_H;
    fitCamera();
  }

  // ---------- Construcción de la escena estática ----------
  function rebuild(data, keepPositions) {
    statics.children.slice().forEach(ch => { statics.remove(ch); disposeGroup(ch); });
    computeLayout(data);
    const dark = isDark();

    // Terreno, acera y árboles
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), mat(dark ? 0x1b2a1f : 0xb8d8a8));
    ground.rotation.x = -Math.PI / 2; ground.position.set(B.w / 2, -SLAB - 0.02, 0); ground.receiveShadow = true;
    statics.add(ground);
    const walk = new T.Mesh(new T.PlaneGeometry(B.w + 8, 6), mat(dark ? 0x3a3f4a : 0xd6d9df));
    walk.rotation.x = -Math.PI / 2; walk.position.set(B.w / 2, -SLAB - 0.01, B.frontZ + 3); walk.receiveShadow = true;
    statics.add(walk);
    tree(-3.5, 2, 1.2); tree(B.w + 3.5, 1, 1.0); tree(B.w + 4.5, -3, 1.3); tree(-4.5, -3, 0.9);

    // Estructura del edificio
    const wallC = dark ? 0x3a3f4a : 0xe9ebef, slabC = dark ? 0x2a2e38 : 0xf7f8fa;
    floors.forEach(r => {
      const y0 = r.y0;
      // Forjado (suelo de la planta)
      const slab = box(B.w, SLAB, BD, slabC, B.w / 2, y0 - SLAB / 2, 0);
      slab.castShadow = false;
      const tint = new T.Color(r.color).lerp(new T.Color(dark ? 0x1c1f26 : 0xffffff), dark ? 0.8 : 0.86);
      const fl = new T.Mesh(new T.PlaneGeometry(B.w, BD), new T.MeshLambertMaterial({ color: tint }));
      fl.rotation.x = -Math.PI / 2; fl.position.set(B.w / 2, y0 + 0.005, 0); fl.receiveShadow = true;
      statics.add(fl);
      // Pared del fondo con ventanas, y laterales
      const back = box(B.w, FLOOR_H, 0.15, wallC, B.w / 2, y0 + FLOOR_H / 2, B.backZ - 0.075);
      back.castShadow = false;
      for (let x = SHAFT_W + 1.2; x < B.w - 1.0; x += 2.4) {
        box(1.5, 1.3, 0.06, dark ? 0x2c4a6b : 0xbfe3ff, x, y0 + 1.95, B.backZ + 0.02);
      }
      const l = box(0.15, FLOOR_H, BD, wallC, -0.075, y0 + FLOOR_H / 2, 0); l.castShadow = false;
      const rt = box(0.15, FLOOR_H, BD, wallC, B.w + 0.075, y0 + FLOOR_H / 2, 0); rt.castShadow = false;
      // Franja de color en el frente de cada planta y rótulo
      box(B.w, 0.28, 0.1, r.color, B.w / 2, y0 - SLAB / 2, B.frontZ + 0.05);
      const sign = textSprite(r.label, { size: 32, h: 0.6, bg: r.color, color: "#fff" });
      sign.position.set(B.w + 0.9, y0 + 1.7, 0);
      statics.add(sign);
      // Hueco del ascensor: pared de separación con puerta y fondo de cristal
      box(0.12, FLOOR_H, BD / 2 - 1.1, wallC, SHAFT_W, y0 + FLOOR_H / 2, B.backZ + (BD / 2 - 1.1) / 2).castShadow = false;
      box(0.12, FLOOR_H, BD / 2 - 1.3, wallC, SHAFT_W, y0 + FLOOR_H / 2, B.frontZ - (BD / 2 - 1.3) / 2).castShadow = false;
      box(0.12, 0.9, 2.4, wallC, SHAFT_W, y0 + FLOOR_H - 0.45, 0).castShadow = false;
      // Fuente de agua junto al ascensor
      box(0.45, 0.9, 0.45, 0xe5e7eb, SHAFT_W + 0.4, y0 + 0.45, B.backZ + 0.45);
      cyl(0.18, 0.18, 0.45, 0x60a5fa, SHAFT_W + 0.4, y0 + 1.12, B.backZ + 0.45);

      if (r.cubicles.length) {
        r.cubicles.forEach((c, j) => {
          if (j > 0) box(0.08, 1.1, 2.9, dark ? 0x3b4150 : 0xcfd4dc, SHAFT_W + 0.6 + j * CUBE_W, y0 + 0.55, B.backZ + 1.45);
          box(1.6, 0.07, 0.75, 0xb98a5a, c.x, y0 + 0.74, c.deskZ);
          box(0.08, 0.72, 0.7, 0x8c6239, c.x - 0.72, y0 + 0.36, c.deskZ);
          box(0.08, 0.72, 0.7, 0x8c6239, c.x + 0.72, y0 + 0.36, c.deskZ);
          box(0.1, 0.14, 0.1, 0x374151, c.x, y0 + 0.85, c.deskZ);
          box(0.36, 0.04, 0.2, 0x374151, c.x, y0 + 0.79, c.deskZ);
          box(0.72, 0.45, 0.05, 0x1f2937, c.x, y0 + 1.15, c.deskZ);
          c.screen = new T.Mesh(new T.PlaneGeometry(0.64, 0.38), new T.MeshLambertMaterial({ color: 0x0f172a, emissive: new T.Color(r.color), emissiveIntensity: 0 }));
          c.screen.position.set(c.x, y0 + 1.15, c.deskZ + 0.03);
          statics.add(c.screen);
          box(0.5, 0.03, 0.18, 0xe5e7eb, c.x, y0 + 0.79, c.deskZ + 0.22);
          box(0.5, 0.08, 0.5, 0x374151, c.x, y0 + 0.45, c.seatZ);
          box(0.5, 0.55, 0.08, 0x374151, c.x, y0 + 0.75, c.seatZ + 0.24);
          cyl(0.05, 0.05, 0.4, 0x6b7280, c.x, y0 + 0.2, c.seatZ);
          cyl(0.28, 0.28, 0.04, 0x6b7280, c.x, y0 + 0.02, c.seatZ);
          const plate = textSprite(c.name, { size: 24, h: 0.3, bg: "rgba(255,255,255,0.85)", color: "#14161a", weight: 600 });
          plate.position.set(c.x + 0.55, y0 + 0.95, c.deskZ + 0.3);
          statics.add(plate);
          if (j % 2 === 0) plant(c.x + 1.15, y0, c.deskZ);
          else box(0.3, 0.5, 0.3, 0x9ca3af, c.x - 1.15, y0 + 0.25, c.deskZ);
        });
      } else if (r.id === "meeting") {
        const t = new T.Mesh(new T.CylinderGeometry(1.8, 1.8, 0.08, 32), mat(0xb98a5a));
        t.scale.z = 0.55; t.position.set(r.center.x, y0 + 0.74, r.center.z); t.castShadow = true; t.receiveShadow = true; statics.add(t);
        cyl(0.25, 0.4, 0.7, 0x8c6239, r.center.x, y0 + 0.35, r.center.z);
        r.spots.forEach(s => {
          const g = new T.Group(); g.position.set(s.x, y0, s.z); g.rotation.y = s.face; statics.add(g);
          box(0.5, 0.08, 0.5, 0x4b5563, 0, 0.45, 0, g);
          box(0.5, 0.55, 0.08, 0x4b5563, 0, 0.75, -0.24, g);
          cyl(0.05, 0.05, 0.4, 0x6b7280, 0, 0.2, 0, g);
        });
        box(2.4, 1.3, 0.08, 0x111827, r.center.x, y0 + 1.7, B.backZ + 0.1);
        box(2.2, 1.1, 0.02, 0x1d4ed8, r.center.x, y0 + 1.7, B.backZ + 0.16);
        box(1.6, 1.0, 0.06, 0xf9fafb, B.w - 2.0, y0 + 1.5, B.backZ + 0.1);
        plant(B.w - 0.7, y0, B.frontZ - 0.7); plant(SHAFT_W + 0.8, y0, B.frontZ - 0.7);
      } else if (r.id === "lobby") {
        // Recepción
        box(2.6, 1.0, 0.7, 0x4f46e5, SHAFT_W + 2.6, y0 + 0.5, B.backZ + 1.2);
        box(2.8, 0.06, 0.8, 0xe5e7eb, SHAFT_W + 2.6, y0 + 1.03, B.backZ + 1.2);
        box(0.5, 0.35, 0.05, 0x1f2937, SHAFT_W + 2.2, y0 + 1.25, B.backZ + 1.2);
        const rec = textSprite("Recepción", { size: 24, h: 0.34, bg: "rgba(79,70,229,0.95)", color: "#fff" });
        rec.position.set(SHAFT_W + 2.6, y0 + 1.6, B.backZ + 1.2); statics.add(rec);
        box(2.0, 0.45, 0.9, 0x6366f1, SHAFT_W + 2.6, y0 + 0.22, B.frontZ - 1.2); // sofá
        box(2.0, 0.5, 0.2, 0x6366f1, SHAFT_W + 2.6, y0 + 0.65, B.frontZ - 0.8);
        plant(SHAFT_W + 1.0, y0, B.frontZ - 0.8);
        // Cafetería (lado derecho)
        box(3.2, 0.95, 0.7, 0x8b5a2b, B.w - 4.6, y0 + 0.475, B.backZ + 0.55);
        box(3.3, 0.06, 0.8, 0xd2b48c, B.w - 4.6, y0 + 0.98, B.backZ + 0.55);
        box(0.45, 0.5, 0.4, 0x374151, B.w - 5.6, y0 + 1.26, B.backZ + 0.55);
        box(0.12, 0.08, 0.12, 0xf3f4f6, B.w - 4.4, y0 + 1.05, B.backZ + 0.5);
        box(0.12, 0.08, 0.12, 0xf3f4f6, B.w - 4.1, y0 + 1.05, B.backZ + 0.6);
        box(0.8, 1.8, 0.7, 0xe5e7eb, B.w - 1.6, y0 + 0.9, B.backZ + 0.55);
        box(0.7, 0.03, 0.02, 0x9ca3af, B.w - 1.6, y0 + 1.2, B.backZ + 0.9);
        r.tables.forEach(t => {
          cyl(0.6, 0.6, 0.06, 0xd2b48c, t.x, y0 + 0.74, t.z, null, 24);
          cyl(0.06, 0.25, 0.72, 0x6b7280, t.x, y0 + 0.36, t.z);
          cyl(0.15, 0.15, 0.08, 0xf59e0b, t.x + 0.2, y0 + 0.8, t.z - 0.1, null, 12);
        });
        const caf = textSprite("☕ Cafetería", { size: 24, h: 0.34, bg: "rgba(217,119,6,0.95)", color: "#fff" });
        caf.position.set(B.w - 4.6, y0 + 1.75, B.backZ + 0.55); statics.add(caf);
        // Puerta de entrada en el frente
        box(0.15, 2.4, 0.15, 0x6b7280, B.w / 2 - 1.0, y0 + 1.2, B.frontZ);
        box(0.15, 2.4, 0.15, 0x6b7280, B.w / 2 + 1.0, y0 + 1.2, B.frontZ);
        box(2.15, 0.15, 0.15, 0x6b7280, B.w / 2, y0 + 2.4, B.frontZ);
        const ent = textSprite("🚪 Entrada", { size: 26, h: 0.44, bg: "rgba(107,114,128,0.95)", color: "#fff" });
        ent.position.set(B.w / 2, y0 + 2.9, B.frontZ + 0.2); statics.add(ent);
      }
    });

    // Hueco del ascensor: cristal, pared del fondo y raíles
    const glass = new T.Mesh(new T.BoxGeometry(SHAFT_W - 0.2, B.h, 0.06), new T.MeshLambertMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.22 }));
    glass.position.set(SHAFT_W / 2, B.h / 2, B.frontZ - 1.2); statics.add(glass);
    box(0.1, B.h, 0.1, 0x6b7280, 0.3, B.h / 2, B.backZ + 0.3).castShadow = false;
    box(0.1, B.h, 0.1, 0x6b7280, SHAFT_W - 0.3, B.h / 2, B.backZ + 0.3).castShadow = false;
    const liftSign = textSprite("🛗 Ascensor", { size: 24, h: 0.4, bg: "rgba(107,114,128,0.95)", color: "#fff" });
    liftSign.position.set(SHAFT_W / 2, B.h + 0.5, 0); statics.add(liftSign);

    // Azotea
    const roof = box(B.w + 0.3, SLAB, BD + 0.3, slabC, B.w / 2, B.h - SLAB / 2, 0); roof.castShadow = false;
    box(0.15, 0.9, BD + 0.3, wallC, -0.075, B.h + 0.45, 0).castShadow = false;
    box(0.15, 0.9, BD + 0.3, wallC, B.w + 0.075, B.h + 0.45, 0).castShadow = false;
    box(B.w + 0.3, 0.9, 0.15, wallC, B.w / 2, B.h + 0.45, B.backZ - 0.075).castShadow = false;
    box(1.2, 0.8, 1.0, 0x9ca3af, B.w - 2.5, B.h + 0.4, -1.2);
    box(1.2, 0.8, 1.0, 0x9ca3af, B.w - 4.2, B.h + 0.4, -1.2);
    cyl(0.04, 0.04, 2.2, 0x6b7280, B.w - 1.0, B.h + 1.1, -2.2);
    plant(SHAFT_W + 1.5, B.h, 1.5); plant(SHAFT_W + 3.0, B.h, 1.5);

    // Luz y sombras
    sun.position.set(B.w / 2 + 14, B.h + 16, 22);
    sun.target.position.set(B.w / 2, B.h / 2, 0);
    scene.add(sun.target);
    const sc = sun.shadow.camera, half = Math.max(B.w, B.h) * 0.8 + 6;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 120;
    sc.updateProjectionMatrix();
    renderer.setClearColor(new T.Color(dark ? 0x14161a : 0xdbeafe));

    // Personajes
    const keep = new Set(data.people.map(p => p.id));
    chars.forEach((ch, pid) => { if (!keep.has(pid)) { scene.remove(ch.g); disposeGroup(ch.g); chars.delete(pid); } });
    pickables = [];
    data.people.forEach(p => {
      let ch = chars.get(p.id);
      const prev = ch ? { pos: ch.pos, room: ch.room, rot: ch.rot, status: ch.status, hidden: ch.hidden, seated: ch.seated } : null;
      if (ch) { scene.remove(ch.g); disposeGroup(ch.g); }
      ch = makeChar(p);
      chars.set(p.id, ch);
      scene.add(ch.g);
      if (prev && keepPositions !== false && rooms[prev.room] && prev.pos.y === rooms[prev.room].y0) {
        Object.assign(ch, prev);
        ch.status = p.status;
        ch.g.visible = !ch.hidden;
        assignDestination(ch);
      } else {
        ch.status = p.status;
        ch.pos = { x: B.w / 2 + rnd(-1.5, 1.5), y: 0, z: B.exitZ + rnd(0.5, 2.5) };
        ch.room = "exit";
        assignDestination(ch);
      }
      setLabel(ch, p);
      ch.g.traverse(o => { if (o.isMesh) { o.userData.pid = p.id; pickables.push(o); } });
    });
  }

  // ---------- Personajes ----------
  function makeChar(p) {
    const g = new T.Group();
    const skin = mat(p.skin), shirt = mat(p.shirt), hair = mat(p.hair), pants = mat(0x2f3542);
    const mk = (w, h, d, m, x, y, z, parent) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; (parent || g).add(b); return b; };

    const legL = new T.Group(), legR = new T.Group();
    legL.position.set(-0.14, 0.76, 0); legR.position.set(0.14, 0.76, 0);
    mk(0.22, 0.76, 0.24, pants, 0, -0.38, 0, legL); mk(0.22, 0.76, 0.24, pants, 0, -0.38, 0, legR);
    mk(0.24, 0.08, 0.3, mat(0x111827), 0, -0.76, 0.03, legL); mk(0.24, 0.08, 0.3, mat(0x111827), 0, -0.76, 0.03, legR);
    g.add(legL, legR);

    const body = mk(0.62, 0.72, 0.36, shirt, 0, 1.12, 0);
    const armL = new T.Group(), armR = new T.Group();
    armL.position.set(-0.4, 1.42, 0); armR.position.set(0.4, 1.42, 0);
    mk(0.18, 0.62, 0.2, shirt, 0, -0.28, 0, armL); mk(0.18, 0.62, 0.2, shirt, 0, -0.28, 0, armR);
    mk(0.16, 0.14, 0.16, skin, 0, -0.64, 0, armL); mk(0.16, 0.14, 0.16, skin, 0, -0.64, 0, armR);
    const cup = mk(0.14, 0.16, 0.14, mat(0xf9fafb), 0, -0.72, 0.1, armR);
    cup.visible = false;
    g.add(armL, armR);

    const head = new T.Group();
    head.position.set(0, 1.5, 0);
    mk(0.46, 0.46, 0.46, skin, 0, 0.25, 0, head);
    mk(0.07, 0.08, 0.03, mat(0x111827), -0.11, 0.3, 0.235, head);
    mk(0.07, 0.08, 0.03, mat(0x111827), 0.11, 0.3, 0.235, head);
    mk(0.14, 0.03, 0.03, mat(0x7f1d1d), 0, 0.14, 0.235, head);
    const style = p.hairStyle || "short";
    if (style !== "bald") mk(0.5, 0.14, 0.5, hair, 0, 0.5, 0, head);
    if (style === "long") mk(0.52, 0.5, 0.2, hair, 0, 0.22, -0.2, head);
    if (style === "bun") { const b = new T.Mesh(new T.SphereGeometry(0.14, 10, 10), hair); b.position.set(0, 0.6, -0.1); head.add(b); }
    if (style === "curly") { const b = new T.Mesh(new T.SphereGeometry(0.33, 12, 12), hair); b.scale.y = 0.6; b.position.set(0, 0.5, 0); head.add(b); }
    g.add(head);

    const ring = new T.Mesh(new T.RingGeometry(0.42, 0.55, 32), new T.MeshBasicMaterial({ color: 0x4f46e5, side: T.DoubleSide, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
    g.add(ring);

    // Cabina del ascensor (solo visible mientras sube o baja)
    const cab = new T.Group();
    const cabFloor = new T.Mesh(new T.BoxGeometry(1.4, 0.12, 1.4), mat(0x9ca3af)); cabFloor.position.y = -0.06; cab.add(cabFloor);
    const cabGlass = new T.Mesh(new T.BoxGeometry(1.4, 2.3, 1.4), new T.MeshLambertMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.25 }));
    cabGlass.position.y = 1.15; cab.add(cabGlass);
    const cabTop = new T.Mesh(new T.BoxGeometry(1.4, 0.1, 1.4), mat(0x6b7280)); cabTop.position.y = 2.35; cab.add(cabTop);
    cab.visible = false;
    g.add(cab);

    return {
      pid: p.id, g, parts: { legL, legR, armL, armR, body, head, cup, ring, cab, label: null, bubble: null },
      pos: { x: 0, y: 0, z: 0 }, rot: 0, targetRot: 0, path: [], room: "exit", dest: null,
      seated: false, hidden: false, riding: false, walkT: Math.random() * 10, idleT: Math.random() * 10,
      status: p.status, visit: null, nextWanderAt: performance.now() + rnd(8000, 25000),
      bubbleUntil: 0, talkUntil: 0, slot: null, arrived: false,
    };
  }

  function setLabel(ch, p) {
    if (ch.parts.label) { ch.g.remove(ch.parts.label); disposeGroup(ch.parts.label); }
    const st = (hooks.STATUS && hooks.STATUS[ch.status]) || { color: "#6b7280" };
    const sp = textSprite(p.name, { size: 26, h: 0.36, dot: st.color, bg: isDark() ? "rgba(28,31,38,0.92)" : "rgba(255,255,255,0.92)", color: isDark() ? "#e7e9ee" : "#14161a" });
    sp.position.set(0, 2.35, 0);
    ch.g.add(sp);
    ch.parts.label = sp;
  }

  // ---------- Destinos y rutas ----------
  function cubicleOf(pid) {
    for (const r of floors) { const c = r.cubicles.find(c => c.pid === pid); if (c) return c; }
    return null;
  }
  function releaseSlot(ch) {
    if (ch.slot) { const arr = slots[ch.slot.roomId]; if (arr) arr[ch.slot.i] = null; ch.slot = null; }
  }
  function takeSlot(roomId, ch) {
    const r = rooms[roomId];
    const arr = slots[roomId] || (slots[roomId] = []);
    let i = arr.findIndex(v => !v);
    if (i < 0) i = arr.length;
    arr[i] = ch.pid;
    ch.slot = { roomId, i };
    const s = r.spots[i % r.spots.length];
    const jitter = i >= r.spots.length ? 0.6 : 0;
    return { roomId, x: s.x + rnd(-jitter, jitter), z: s.z + rnd(-jitter, jitter), face: s.face, seat: !!s.seat && !jitter };
  }
  function deskDest(ch) {
    const c = cubicleOf(ch.pid);
    if (!c) return { roomId: "lobby", x: rnd(SHAFT_W + 1, B.w - 1), z: rnd(-1, 1), face: 0 };
    return { roomId: c.roomId, x: c.x, z: c.seatZ, face: c.face, seat: true, desk: c };
  }
  function assignDestination(ch) {
    releaseSlot(ch);
    let dest;
    if (ch.status === "working") dest = deskDest(ch);
    else if (ch.status === "meeting") dest = takeSlot("meeting", ch);
    else if (ch.status === "break") dest = takeSlot("lobby", ch);
    else dest = { roomId: "exit", x: B.w / 2 + rnd(-1, 1), z: B.exitZ, face: 0, leave: true };
    go(ch, dest);
  }
  function go(ch, dest) {
    if (ch.hidden || ch.room === "exit") {
      ch.pos = { x: B.w / 2 + rnd(-1, 1), y: 0, z: B.exitZ };
      ch.room = "exit";
      ch.hidden = false; ch.g.visible = true;
    }
    if (ch.dest && ch.dest.desk) ch.dest.desk.screen.material.emissiveIntensity = 0;
    ch.dest = dest;
    ch.seated = false;
    ch.arrived = false;
    ch.path = pathTo(ch, dest);
  }
  // Ruta: por la planta hasta el ascensor, subir/bajar, y por la planta de destino
  function pathTo(ch, dest) {
    const pts = [];
    const P = (x, y, z, room, ride) => pts.push({ x, y, z, room, ride });
    const cur = ch.room === "exit" ? null : rooms[ch.room];
    const tgt = dest.roomId === "exit" ? null : rooms[dest.roomId];
    const liftX = SHAFT_W / 2 + rnd(-0.35, 0.35);
    const fromY = cur ? cur.y0 : 0, toY = tgt ? tgt.y0 : 0;
    const A = B.aisleZ;

    if (cur && tgt && cur.id === tgt.id) {
      P(ch.pos.x, fromY, A, cur.id); P(dest.x, fromY, A, cur.id); P(dest.x, fromY, dest.z, cur.id);
    } else {
      // Hasta el ascensor (o la entrada) de la planta actual
      if (cur) { P(ch.pos.x, fromY, A, cur.id); }
      else { P(ch.pos.x, 0, B.frontZ - 0.3, "lobby"); P(B.w / 2, 0, A, "lobby"); }
      if (fromY !== toY) {
        P(B.lobbyX, fromY, A, cur ? cur.id : "lobby");
        P(liftX, fromY, A, cur ? cur.id : "lobby");
        P(liftX, fromY, 0, cur ? cur.id : "lobby");
        P(liftX, toY, 0, tgt ? tgt.id : "lobby", true);
        P(liftX, toY, A, tgt ? tgt.id : "lobby");
        P(B.lobbyX, toY, A, tgt ? tgt.id : "lobby");
      }
      if (tgt) { P(dest.x, toY, A, tgt.id); P(dest.x, toY, dest.z, tgt.id); }
      else { P(B.w / 2, 0, A, "lobby"); P(B.w / 2, 0, B.frontZ + 0.3, "lobby"); P(dest.x, 0, dest.z, "exit"); }
    }
    return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y, p.z - pts[i - 1].z) > 0.05);
  }
  function arrive(ch) {
    ch.arrived = true;
    const d = ch.dest;
    if (!d) return;
    ch.targetRot = d.face;
    if (d.seat) ch.seated = true;
    if (d.desk) d.desk.screen.material.emissiveIntensity = 0.9;
    if (d.leave) { ch.hidden = true; ch.g.visible = false; ch.room = "exit"; }
    if (ch.visit && ch.visit.phase === "going") {
      ch.visit.phase = "there";
      ch.visit.until = performance.now() + rnd(4500, 9000);
      ch.talkUntil = ch.visit.until;
      const host = ch.visit.host && chars.get(ch.visit.host);
      if (host) host.talkUntil = ch.visit.until;
      if (ch.visit.text && hooks.log) hooks.log(ch.visit.text);
    } else if (ch.visit && ch.visit.phase === "returning") {
      ch.visit = null;
    }
    ch.nextWanderAt = performance.now() + rnd(12000, 40000);
  }

  // Paseos espontáneos: visitar a alguien (incluso en otra planta), ir a por agua, estirar las piernas
  function maybeWander(ch, now, data) {
    if (!ch.arrived || ch.visit || ch.hidden || now < ch.nextWanderAt) return;
    ch.nextWanderAt = now + rnd(12000, 40000);
    const p = data.people.find(x => x.id === ch.pid);
    if (!p) return;
    if (ch.status === "working") {
      const r = Math.random();
      if (r < 0.55) {
        const others = data.people.filter(o => o.id !== ch.pid && chars.get(o.id) && chars.get(o.id).status === "working" && chars.get(o.id).arrived && !chars.get(o.id).visit);
        const o = others.length && pick(others);
        const c = o && cubicleOf(o.id);
        if (!c) return;
        const sameFloor = c.roomId === ch.room;
        ch.visit = { phase: "going", host: o.id, text: `<b>${esc(p.name)}</b> ${sameFloor ? "pasa a ver a" : "sube a ver a"} <b>${esc(o.name)}</b> 💬` };
        go(ch, { roomId: c.roomId, x: c.x + 0.9, z: c.visitZ, face: Math.atan2(c.x - (c.x + 0.9), c.seatZ - c.visitZ) });
      } else if (r < 0.85) {
        const fl = rooms[ch.room];
        if (!fl) return;
        ch.visit = { phase: "going", text: `<b>${esc(p.name)}</b> va a por agua 💧` };
        go(ch, { roomId: fl.id, x: fl.cooler.x, z: fl.cooler.z, face: fl.cooler.face });
      } else {
        const c = cubicleOf(ch.pid);
        if (!c) return;
        ch.visit = { phase: "going" };
        go(ch, { roomId: c.roomId, x: c.x, z: c.visitZ, face: 0 });
      }
    } else if (ch.status === "break") {
      releaseSlot(ch);
      go(ch, takeSlot("lobby", ch));
    }
  }

  // ---------- Animación ----------
  let lastT = 0;
  function loop(t) {
    if (!renderer) return;
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (!container || !container.clientWidth || container.offsetParent === null || document.hidden) return;
    const now = performance.now();

    chars.forEach(ch => {
      if (lastData) maybeWander(ch, now, lastData);
      if (ch.visit && ch.visit.phase === "there" && now > ch.visit.until) {
        ch.visit.phase = "returning";
        go(ch, deskDest(ch));
      }
      animateChar(ch, dt, now);
    });

    updateCamera();
    if (pointer.moved) { pointer.moved = false; updateHover(); }
    renderer.render(scene, camera);
  }

  function animateChar(ch, dt, now) {
    if (ch.hidden) return;
    const P = ch.parts;
    let bob = 0;
    ch.riding = false;
    if (ch.path.length) {
      const wp = ch.path[0];
      const dx = wp.x - ch.pos.x, dy = wp.y - ch.pos.y, dz = wp.z - ch.pos.z, d = Math.hypot(dx, dy, dz);
      const riding = !!wp.ride;
      const step = (riding ? LIFT_SPEED : SPEED) * dt;
      if (d <= step) {
        ch.pos.x = wp.x; ch.pos.y = wp.y; ch.pos.z = wp.z;
        if (wp.room) ch.room = wp.room;
        ch.path.shift();
        if (!ch.path.length) arrive(ch);
      } else {
        ch.pos.x += dx / d * step; ch.pos.y += dy / d * step; ch.pos.z += dz / d * step;
        if (!riding) ch.targetRot = Math.atan2(dx, dz);
      }
      ch.seated = false;
      P.cup.visible = ch.status === "break";
      if (riding) {
        ch.riding = true;
        ch.targetRot = 0;
        P.legL.rotation.x = P.legR.rotation.x = 0;
        P.armL.rotation.x = P.armR.rotation.x = 0;
        P.head.rotation.y = Math.sin(now / 600) * 0.2;
      } else {
        ch.walkT += dt * 9;
        const s = Math.sin(ch.walkT);
        P.legL.rotation.x = s * 0.75; P.legR.rotation.x = -s * 0.75;
        P.armL.rotation.x = -s * 0.6; P.armR.rotation.x = s * 0.6;
        P.head.rotation.y = 0;
        bob = Math.abs(Math.cos(ch.walkT)) * 0.06;
      }
    } else {
      ch.idleT += dt;
      const it = ch.idleT;
      const talking = now < ch.talkUntil;
      P.legL.rotation.x = P.legR.rotation.x = ch.seated ? -Math.PI / 2 : 0;
      P.cup.visible = ch.status === "break";
      if (ch.seated && ch.status === "working") {
        P.armL.rotation.x = -1.15 + Math.sin(it * 14) * 0.08;
        P.armR.rotation.x = -1.15 + Math.cos(it * 13) * 0.08;
        P.head.rotation.y = Math.sin(it * 0.8) * 0.08;
        P.head.rotation.x = 0.12 + Math.sin(it * 1.7) * 0.03;
      } else if (ch.seated) {
        P.armL.rotation.x = -0.9; P.armR.rotation.x = -0.9 + (talking ? Math.sin(it * 6) * 0.35 : 0);
        P.head.rotation.y = Math.sin(it * 1.3) * 0.25;
        P.head.rotation.x = talking ? Math.sin(it * 9) * 0.05 : 0;
      } else if (ch.status === "break") {
        const sip = (Math.sin(it * 1.2) + 1) / 2;
        P.armR.rotation.x = -1.3 - sip * 0.9;
        P.armL.rotation.x = Math.sin(it * 0.9) * 0.1;
        P.head.rotation.y = Math.sin(it * 0.6) * 0.3;
        P.head.rotation.x = -sip * 0.15;
      } else {
        P.armL.rotation.x = Math.sin(it * 1.1) * 0.1;
        P.armR.rotation.x = talking ? -0.6 + Math.sin(it * 5) * 0.35 : Math.cos(it * 1.3) * 0.1;
        P.head.rotation.y = talking ? Math.sin(it * 2.5) * 0.2 : Math.sin(it * 0.5) * 0.15;
        P.head.rotation.x = talking ? Math.sin(it * 8) * 0.04 : 0;
      }
      if (ch.visit && ch.visit.phase === "there" && !ch.visit.host) {
        P.armL.rotation.x = -2.6 + Math.sin(it * 2) * 0.2; P.armR.rotation.x = -2.6 + Math.cos(it * 2) * 0.2;
      }
    }
    P.cab.visible = ch.riding;
    let diff = ch.targetRot - ch.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    ch.rot += diff * Math.min(1, dt * 10);
    ch.g.rotation.y = ch.rot;
    ch.g.position.set(ch.pos.x, ch.pos.y + (ch.seated ? -0.31 : 0) + bob, ch.pos.z);

    if (P.bubble && now > ch.bubbleUntil) { ch.g.remove(P.bubble); disposeGroup(P.bubble); P.bubble = null; }
    P.ring.visible = hoverPid === ch.pid;
  }

  // ---------- Cámara y controles ----------
  function updateCamera() {
    cam.theta = Math.max(-1.35, Math.min(1.35, cam.theta)); // siempre desde el frente abierto
    cam.phi = Math.max(0.3, Math.min(1.5, cam.phi));
    cam.r = Math.max(6, Math.min(200, cam.r));
    camera.position.set(
      cam.target.x + cam.r * Math.sin(cam.phi) * Math.sin(cam.theta),
      cam.target.y + cam.r * Math.cos(cam.phi),
      cam.target.z + cam.r * Math.sin(cam.phi) * Math.cos(cam.theta));
    camera.lookAt(cam.target);
  }

  function bindControls(el) {
    const active = new Map();
    let moved = 0, pinch = null;
    const c = renderer.domElement;
    c.style.touchAction = "none";
    c.addEventListener("contextmenu", e => e.preventDefault());
    c.addEventListener("pointerdown", e => {
      c.setPointerCapture(e.pointerId);
      active.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
      moved = 0;
      if (active.size === 2) { const [a, b] = [...active.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
      c.style.cursor = "grabbing";
    });
    c.addEventListener("pointermove", e => {
      const rect = c.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      pointer.moved = true; pointer.inside = true;
      const a = active.get(e.pointerId);
      if (!a) return;
      const dx = e.clientX - a.x, dy = e.clientY - a.y;
      a.x = e.clientX; a.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (active.size === 2) {
        const [p1, p2] = [...active.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        if (pinch) { cam.userZoomed = true; cam.r *= pinch.d / d; pan(mx - pinch.mx, my - pinch.my); }
        pinch = { d, mx, my };
        return;
      }
      if (a.button === 2 || a.shift) pan(dx, dy);
      else { cam.theta -= dx * 0.006; cam.phi -= dy * 0.006; }
    });
    const up = e => {
      const a = active.get(e.pointerId);
      active.delete(e.pointerId);
      pinch = null;
      c.style.cursor = "grab";
      if (a && moved < 6 && e.type === "pointerup" && a.button === 0) {
        const pid = pickAt(e.clientX, e.clientY);
        if (pid && hooks.openPopover) hooks.openPopover(pid, { left: e.clientX - 20, right: e.clientX + 20, top: e.clientY - 20, bottom: e.clientY + 20, width: 40 });
      }
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", () => { pointer.inside = false; hoverPid = null; });
    c.addEventListener("wheel", e => { e.preventDefault(); cam.userZoomed = true; cam.r *= 1 + Math.sign(e.deltaY) * 0.08; }, { passive: false });
    c.style.cursor = "grab";

    function pan(dx, dy) {
      cam.userZoomed = true;
      const k = cam.r * 0.0016;
      const rx = Math.cos(cam.theta), rz = -Math.sin(cam.theta);    // derecha de la cámara
      cam.target.x -= rx * dx * k;
      cam.target.z -= rz * dx * k;
      cam.target.y += dy * k;                                       // arrastrar en vertical = subir/bajar plantas
      cam.target.x = Math.max(-6, Math.min(B.w + 6, cam.target.x));
      cam.target.y = Math.max(0, Math.min(B.h + 4, cam.target.y));
      cam.target.z = Math.max(-6, Math.min(10, cam.target.z));
    }
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables.filter(o => isVisibleChain(o)), false);
    return hits.length ? hits[0].object.userData.pid : null;
  }
  function isVisibleChain(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
  function updateHover() {
    if (!pointer.inside) { hoverPid = null; return; }
    ndc.set(pointer.x, pointer.y);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables.filter(o => isVisibleChain(o)), false);
    hoverPid = hits.length ? hits[0].object.userData.pid : null;
    renderer.domElement.style.cursor = hoverPid ? "pointer" : "grab";
  }
})();
