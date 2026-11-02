// ---------- Oficina virtual: motor 3D (Three.js) ----------
// Dibuja la planta en 3D: cada departamento es una sala, cada persona tiene
// su propio despacho (mesa, silla, monitor, placa) y se mueve por los pasillos
// hacia su mesa, la sala de reuniones, la cafetería o la salida.
// Expone window.Office3D = { available, mount, unmount, sync, say }.
(function () {
  "use strict";

  const O = { available: () => !!window.THREE };
  window.Office3D = O;
  if (!window.THREE) return;
  const T = THREE;

  // Medidas (metros)
  const CORR = 2.2;      // mitad del ancho del pasillo
  const ROOM_D = 5.6;    // fondo de cada sala
  const CUBE_W = 3.0;    // ancho de cada despacho
  const WALL_H = 1.05;   // paredes bajas, estilo maqueta
  const SPEED = 1.7;     // m/s al caminar
  const EXIT_X = -2.6;

  let container, renderer, scene, camera, statics, sun, hooks, lastData;
  let rooms = {}, slots = {}, extent = { minX: -4, maxX: 10 };
  let chars = new Map(), pickables = [], sig = "";
  let hoverPid = null, pointer = { x: 0, y: 0, moved: false, inside: false };
  const cam = { theta: -0.55, phi: 0.95, r: 26, target: new T.Vector3(5, 0, 0) };
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
  function plant(x, z, parent) {
    cyl(0.18, 0.14, 0.3, 0xb5651d, x, 0.15, z, parent);
    const leaves = cyl(0.02, 0.32, 0.7, 0x2e8b57, x, 0.62, z, parent, 8);
    leaves.castShadow = true;
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
    if (o.dot) {
      ctx.fillStyle = o.dot; ctx.beginPath(); ctx.arc(pad + dot * 0.35, r, dot * 0.32, 0, Math.PI * 2); ctx.fill();
    }
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
    help.textContent = "Arrastra para girar · Rueda o pellizco para zoom · Botón derecho para desplazar";
    el.appendChild(help);

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(42, 1, 0.1, 300);
    scene.add(new T.HemisphereLight(0xffffff, 0x6b7280, 0.85));
    sun = new T.DirectionalLight(0xffffff, 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
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

  // ---------- Distribución de salas ----------
  function computeLayout(data) {
    rooms = {}; slots = {};
    const cur = { "-1": 0, "1": 0 };
    const addRoom = (id, w, color, label) => {
      const side = cur["-1"] <= cur["1"] ? -1 : 1;
      const x0 = cur[String(side)];
      cur[String(side)] += w + 0.7;
      const r = {
        id, side, x0, x1: x0 + w, w, color, label,
        zWall: side * CORR, zFar: side * (CORR + ROOM_D),
        door: { x: x0 + w / 2 }, zOut: side * (CORR - 0.8), aisleZ: side * (CORR + 1.0),
        spots: [], cubicles: [],
      };
      rooms[id] = r;
      return r;
    };

    data.departments.forEach(d => {
      const members = data.people.filter(p => p.deptId === d.id);
      const n = Math.max(1, members.length);
      const r = addRoom(d.id, n * CUBE_W + 0.6, d.color, `${d.emoji} ${d.name}`);
      r.dept = d;
      r.cubicles = members.map((p, j) => ({
        pid: p.id, name: p.name, roomId: d.id,
        x: r.x0 + 0.3 + j * CUBE_W + CUBE_W / 2,
        deskZ: r.side * (CORR + ROOM_D - 0.95),
        seatZ: r.side * (CORR + ROOM_D - 1.8),
        visitZ: r.side * (CORR + 2.4),
        face: r.side > 0 ? 0 : Math.PI,
      }));
    });

    const m = addRoom("meeting", 7.4, "#7c3aed", "🗣️ Sala de reuniones");
    m.center = { x: m.x0 + m.w / 2, z: m.side * (CORR + ROOM_D / 2 + 0.35) };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const x = m.center.x + Math.cos(a) * 2.5, z = m.center.z + Math.sin(a) * 1.65;
      m.spots.push({ x, z, face: Math.atan2(m.center.x - x, m.center.z - z), seat: true });
    }

    const c = addRoom("cafe", 7.0, "#d97706", "☕ Cafetería");
    c.tables = [
      { x: c.x0 + 1.9, z: c.side * (CORR + 2.4) },
      { x: c.x0 + 5.1, z: c.side * (CORR + 2.4) },
    ];
    c.tables.forEach(t => {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const x = t.x + Math.cos(a) * 1.0, z = t.z + Math.sin(a) * 1.0;
        c.spots.push({ x, z, face: Math.atan2(t.x - x, t.z - z) });
      }
    });
    c.spots.push({ x: c.x0 + 2.2, z: c.side * (CORR + ROOM_D - 1.3), face: c.side > 0 ? 0 : Math.PI });
    c.spots.push({ x: c.x0 + 3.5, z: c.side * (CORR + ROOM_D - 1.3), face: c.side > 0 ? 0 : Math.PI });

    extent = { minX: -4.5, maxX: Math.max(cur["-1"], cur["1"]) + 1.5 };
    rooms.corridorCooler = null;
    cam.target.set((extent.minX + extent.maxX) / 2, 0.2, 0);
    cam.r = Math.max(18, (extent.maxX - extent.minX) * 1.12);
  }

  // ---------- Construcción de la escena estática ----------
  function rebuild(data, keepPositions) {
    statics.children.slice().forEach(ch => { statics.remove(ch); disposeGroup(ch); });
    computeLayout(data);
    const dark = isDark();

    // Suelo general y pasillo
    const ground = new T.Mesh(
      new T.PlaneGeometry(extent.maxX - extent.minX + 16, (CORR + ROOM_D) * 2 + 16),
      mat(dark ? 0x1a1d24 : 0xdfe3ea));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((extent.minX + extent.maxX) / 2, -0.02, 0);
    ground.receiveShadow = true;
    statics.add(ground);
    const corridor = new T.Mesh(new T.PlaneGeometry(extent.maxX - extent.minX, CORR * 2), mat(dark ? 0x2a2e38 : 0xeef0f4));
    corridor.rotation.x = -Math.PI / 2;
    corridor.position.set((extent.minX + extent.maxX) / 2, 0, 0);
    corridor.receiveShadow = true;
    statics.add(corridor);

    // Salida
    const ex = EXIT_X + 0.6;
    box(0.2, 2.4, 0.2, 0x6b7280, ex, 1.2, -0.9);
    box(0.2, 2.4, 0.2, 0x6b7280, ex, 1.2, 0.9);
    box(0.2, 0.2, 2.0, 0x6b7280, ex, 2.4, 0);
    const exitSign = textSprite("🚪 Salida", { size: 28, h: 0.5, bg: "rgba(156,163,175,0.95)", color: "#fff" });
    exitSign.position.set(ex, 2.9, 0);
    statics.add(exitSign);
    plant(ex + 0.5, -1.6); plant(ex + 0.5, 1.6);

    // Fuente de agua al final del pasillo
    const cx = extent.maxX - 1.0;
    box(0.5, 0.9, 0.5, 0xe5e7eb, cx, 0.45, 1.3);
    cyl(0.2, 0.2, 0.5, 0x60a5fa, cx, 1.15, 1.3);
    rooms.corridorCooler = { x: cx - 0.8, z: 0.9, face: Math.atan2(cx - (cx - 0.8), 1.3 - 0.9) };
    plant(cx, -1.4);

    // Salas
    Object.values(rooms).forEach(r => {
      if (!r || !r.id) return;
      const side = r.side, zc = (r.zWall + r.zFar) / 2;
      const tint = new T.Color(r.color).lerp(new T.Color(dark ? 0x1c1f26 : 0xffffff), dark ? 0.78 : 0.84);
      const fl = new T.Mesh(new T.PlaneGeometry(r.w, ROOM_D), new T.MeshLambertMaterial({ color: tint }));
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(r.x0 + r.w / 2, 0.005, zc);
      fl.receiveShadow = true;
      statics.add(fl);

      const wallC = r.color, th = 0.12;
      box(r.w + th, WALL_H, th, wallC, r.x0 + r.w / 2, WALL_H / 2, r.zFar);                 // fondo
      box(th, WALL_H, ROOM_D, wallC, r.x0, WALL_H / 2, zc);                                 // izquierda
      box(th, WALL_H, ROOM_D, wallC, r.x1, WALL_H / 2, zc);                                 // derecha
      const doorW = 1.5, segW = (r.w - doorW) / 2;                                          // frente con puerta
      box(segW, WALL_H, th, wallC, r.x0 + segW / 2, WALL_H / 2, r.zWall);
      box(segW, WALL_H, th, wallC, r.x1 - segW / 2, WALL_H / 2, r.zWall);
      const sign = textSprite(r.label, { size: 32, h: 0.62, bg: r.color, color: "#fff" });
      sign.position.set(r.x0 + r.w / 2, WALL_H + 0.9, r.zFar);
      statics.add(sign);

      if (r.cubicles.length) {
        r.cubicles.forEach((c, j) => {
          if (j > 0) box(0.08, 0.95, 3.1, dark ? 0x3b4150 : 0xcfd4dc, r.x0 + 0.3 + j * CUBE_W, 0.475, r.zFar - side * 1.55);
          // Mesa
          box(1.6, 0.07, 0.75, 0xb98a5a, c.x, 0.74, c.deskZ);
          box(0.08, 0.72, 0.7, 0x8c6239, c.x - 0.72, 0.36, c.deskZ);
          box(0.08, 0.72, 0.7, 0x8c6239, c.x + 0.72, 0.36, c.deskZ);
          // Monitor
          box(0.1, 0.14, 0.1, 0x374151, c.x, 0.85, c.deskZ);
          box(0.36, 0.04, 0.2, 0x374151, c.x, 0.79, c.deskZ);
          box(0.72, 0.45, 0.05, 0x1f2937, c.x, 1.15, c.deskZ);
          c.screen = new T.Mesh(new T.PlaneGeometry(0.64, 0.38), new T.MeshLambertMaterial({ color: 0x0f172a, emissive: new T.Color(r.color), emissiveIntensity: 0 }));
          c.screen.position.set(c.x, 1.15, c.deskZ - side * 0.03);
          c.screen.rotation.y = side > 0 ? Math.PI : 0;
          statics.add(c.screen);
          // Teclado y silla
          box(0.5, 0.03, 0.18, 0xe5e7eb, c.x, 0.79, c.deskZ - side * 0.22);
          box(0.5, 0.08, 0.5, 0x374151, c.x, 0.45, c.seatZ);
          box(0.5, 0.55, 0.08, 0x374151, c.x, 0.75, c.seatZ - side * 0.24);
          cyl(0.05, 0.05, 0.4, 0x6b7280, c.x, 0.2, c.seatZ);
          cyl(0.28, 0.28, 0.04, 0x6b7280, c.x, 0.02, c.seatZ);
          // Placa con el nombre sobre la mesa
          const plate = textSprite(c.name, { size: 24, h: 0.3, bg: "rgba(255,255,255,0.85)", color: "#14161a", weight: 600 });
          plate.position.set(c.x + 0.55, 0.95, c.deskZ - side * 0.3);
          statics.add(plate);
          if (j % 2 === 0) plant(c.x + 1.15, c.deskZ);
          else box(0.3, 0.5, 0.3, 0x9ca3af, c.x - 1.15, 0.25, c.deskZ); // archivador
        });
      } else if (r.id === "meeting") {
        const t = new T.Mesh(new T.CylinderGeometry(1.7, 1.7, 0.08, 32), mat(0xb98a5a));
        t.scale.z = 0.6; t.position.set(r.center.x, 0.74, r.center.z); t.castShadow = true; t.receiveShadow = true; statics.add(t);
        cyl(0.25, 0.4, 0.7, 0x8c6239, r.center.x, 0.35, r.center.z);
        r.spots.forEach(s => {
          const g = new T.Group(); g.position.set(s.x, 0, s.z); g.rotation.y = s.face; statics.add(g);
          box(0.5, 0.08, 0.5, 0x4b5563, 0, 0.45, 0, g);
          box(0.5, 0.55, 0.08, 0x4b5563, 0, 0.75, -0.24, g);
          cyl(0.05, 0.05, 0.4, 0x6b7280, 0, 0.2, 0, g);
        });
        // Pantalla y pizarra en la pared del fondo
        box(2.2, 1.2, 0.08, 0x111827, r.x0 + r.w / 2, 1.4, r.zFar - side * 0.1);
        box(2.0, 1.0, 0.02, 0x1d4ed8, r.x0 + r.w / 2, 1.4, r.zFar - side * 0.16);
        box(1.6, 1.0, 0.06, 0xf9fafb, r.x0 + 1.2, 1.3, r.zFar - side * 0.1);
        plant(r.x0 + 0.5, r.zWall + side * 0.6); plant(r.x1 - 0.5, r.zWall + side * 0.6);
      } else if (r.id === "cafe") {
        // Barra, máquina de café, nevera
        box(3.2, 0.95, 0.7, 0x8b5a2b, r.x0 + 2.6, 0.475, r.zFar - side * 0.55);
        box(3.3, 0.06, 0.8, 0xd2b48c, r.x0 + 2.6, 0.98, r.zFar - side * 0.55);
        box(0.45, 0.5, 0.4, 0x374151, r.x0 + 1.6, 1.26, r.zFar - side * 0.55);
        box(0.12, 0.08, 0.12, 0xf3f4f6, r.x0 + 2.4, 1.05, r.zFar - side * 0.5);
        box(0.12, 0.08, 0.12, 0xf3f4f6, r.x0 + 2.7, 1.05, r.zFar - side * 0.6);
        box(0.8, 1.8, 0.7, 0xe5e7eb, r.x1 - 0.8, 0.9, r.zFar - side * 0.55);
        box(0.7, 0.03, 0.02, 0x9ca3af, r.x1 - 0.8, 1.2, r.zFar - side * 0.9);
        r.tables.forEach(t => {
          cyl(0.6, 0.6, 0.06, 0xd2b48c, t.x, 0.74, t.z, null, 24);
          cyl(0.06, 0.25, 0.72, 0x6b7280, t.x, 0.36, t.z);
          cyl(0.15, 0.15, 0.08, 0xf59e0b, t.x + 0.2, 0.8, t.z - 0.1, null, 12); // bandeja
        });
        plant(r.x0 + 0.5, r.zWall + side * 0.6); plant(r.x1 - 0.5, r.zWall + side * 0.6);
        box(1.0, 0.7, 0.06, 0x111827, r.x0 + 5.2, 1.5, r.zFar - side * 0.1); // menú del día
      }
    });

    // Luz y sombras cubriendo toda la planta
    const cxw = (extent.minX + extent.maxX) / 2;
    sun.position.set(cxw + 12, 22, 14);
    sun.target.position.set(cxw, 0, 0);
    scene.add(sun.target);
    const sc = sun.shadow.camera, half = Math.max(16, (extent.maxX - extent.minX) * 0.75);
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 80;
    sc.updateProjectionMatrix();
    renderer.setClearColor(new T.Color(dark ? 0x14161a : 0xf5f6f8));

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
      if (prev && keepPositions !== false) {
        Object.assign(ch, prev);
        ch.status = p.status;
        ch.g.visible = !ch.hidden;
        ch.room = roomStillExists(prev.room) ? prev.room : "corridor";
        assignDestination(ch, true);
      } else {
        ch.status = p.status;
        ch.pos = { x: EXIT_X - 1.5 - Math.random() * 2, z: rnd(-0.8, 0.8) };
        ch.room = "exit";
        assignDestination(ch);
      }
      setLabel(ch, p);
      ch.g.traverse(o => { if (o.isMesh) { o.userData.pid = p.id; pickables.push(o); } });
    });
  }
  function roomStillExists(id) { return id === "corridor" || id === "exit" || !!rooms[id]; }

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

    return {
      pid: p.id, g, parts: { legL, legR, armL, armR, body, head, cup, ring, label: null, bubble: null },
      pos: { x: 0, z: 0 }, rot: 0, targetRot: 0, path: [], room: "corridor", dest: null,
      seated: false, hidden: false, walkT: Math.random() * 10, idleT: Math.random() * 10,
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
    for (const r of Object.values(rooms)) { if (r && r.cubicles) { const c = r.cubicles.find(c => c.pid === pid); if (c) return c; } }
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
    if (!c) return { roomId: "corridor", x: rnd(1, extent.maxX - 3), z: rnd(-1, 1), face: 0 };
    return { roomId: c.roomId, x: c.x, z: c.seatZ, face: c.face, seat: true, desk: c };
  }
  function assignDestination(ch, silent) {
    releaseSlot(ch);
    let dest;
    if (ch.status === "working") dest = deskDest(ch);
    else if (ch.status === "meeting") dest = takeSlot("meeting", ch);
    else if (ch.status === "break") dest = takeSlot("cafe", ch);
    else dest = { roomId: "exit", x: EXIT_X, z: 0, face: -Math.PI / 2, leave: true };
    go(ch, dest);
    if (ch.hidden && ch.status !== "away") { ch.hidden = false; ch.g.visible = true; }
  }
  function go(ch, dest) {
    if (ch.hidden || ch.room === "exit") {
      ch.pos = { x: EXIT_X - 0.6, z: rnd(-0.5, 0.5) };
      ch.room = "corridor";
      ch.hidden = false; ch.g.visible = true;
    }
    ch.dest = dest;
    ch.seated = false;
    ch.arrived = false;
    ch.path = pathTo(ch, dest);
    if (ch.dest.desk) ch.dest.desk.screen.material.emissiveIntensity = 0;
  }
  function pathTo(ch, dest) {
    const pts = [];
    const cur = rooms[ch.room], tgt = rooms[dest.roomId];
    const P = (x, z, room) => pts.push({ x, z, room });
    if (cur && ch.room === dest.roomId) {
      P(ch.pos.x, cur.aisleZ, cur.id); P(dest.x, cur.aisleZ, cur.id); P(dest.x, dest.z, cur.id);
    } else {
      if (cur) { P(ch.pos.x, cur.aisleZ, cur.id); P(cur.door.x, cur.aisleZ, cur.id); P(cur.door.x, cur.zOut, "corridor"); }
      if (tgt) { P(tgt.door.x, tgt.zOut, "corridor"); P(tgt.door.x, tgt.aisleZ, tgt.id); P(dest.x, tgt.aisleZ, tgt.id); P(dest.x, dest.z, tgt.id); }
      else P(dest.x, dest.z, dest.roomId === "exit" ? "exit" : "corridor");
    }
    // Elimina puntos duplicados consecutivos
    return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.05);
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
      if (host) { host.talkUntil = ch.visit.until; }
      if (ch.visit.text && hooks.log) hooks.log(ch.visit.text);
    } else if (ch.visit && ch.visit.phase === "returning") {
      ch.visit = null;
    }
    ch.nextWanderAt = performance.now() + rnd(12000, 40000);
  }

  // Paseos espontáneos: visitar a un compañero, ir a por agua, estirar las piernas
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
        ch.visit = { phase: "going", host: o.id, text: `<b>${esc(p.name)}</b> pasa a ver a <b>${esc(o.name)}</b> 💬` };
        go(ch, { roomId: c.roomId, x: c.x + 0.9, z: c.visitZ, face: Math.atan2(c.x - (c.x + 0.9), c.seatZ - c.visitZ) });
      } else if (r < 0.85 && rooms.corridorCooler) {
        ch.visit = { phase: "going", text: `<b>${esc(p.name)}</b> va a por agua 💧` };
        go(ch, Object.assign({ roomId: "corridor" }, rooms.corridorCooler));
      } else {
        const c = cubicleOf(ch.pid);
        if (!c) return;
        ch.visit = { phase: "going" };
        go(ch, { roomId: c.roomId, x: c.x, z: c.visitZ, face: c.face + Math.PI });
      }
    } else if (ch.status === "break") {
      releaseSlot(ch);
      go(ch, takeSlot("cafe", ch));
    }
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

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
      animateChar(ch, t / 1000, dt, now);
    });

    updateCamera();
    if (pointer.moved) { pointer.moved = false; updateHover(); }
    renderer.render(scene, camera);
  }

  function animateChar(ch, t, dt, now) {
    if (ch.hidden) return;
    const P = ch.parts;
    let bob = 0;
    if (ch.path.length) {
      const wp = ch.path[0];
      const dx = wp.x - ch.pos.x, dz = wp.z - ch.pos.z, d = Math.hypot(dx, dz);
      const step = SPEED * dt;
      if (d <= step) {
        ch.pos.x = wp.x; ch.pos.z = wp.z;
        if (wp.room) ch.room = wp.room;
        ch.path.shift();
        if (!ch.path.length) arrive(ch);
      } else {
        ch.pos.x += dx / d * step; ch.pos.z += dz / d * step;
        ch.targetRot = Math.atan2(dx, dz);
      }
      ch.walkT += dt * 9;
      const s = Math.sin(ch.walkT);
      P.legL.rotation.x = s * 0.75; P.legR.rotation.x = -s * 0.75;
      P.armL.rotation.x = -s * 0.6; P.armR.rotation.x = s * 0.6;
      P.head.rotation.y = 0;
      bob = Math.abs(Math.cos(ch.walkT)) * 0.06;
      ch.seated = false;
      P.cup.visible = ch.status === "break";
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
        // estirándose / bebiendo agua
        P.armL.rotation.x = -2.6 + Math.sin(it * 2) * 0.2; P.armR.rotation.x = -2.6 + Math.cos(it * 2) * 0.2;
      }
    }
    // Giro suave hacia la dirección objetivo
    let diff = ch.targetRot - ch.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    ch.rot += diff * Math.min(1, dt * 10);
    ch.g.rotation.y = ch.rot;
    ch.g.position.set(ch.pos.x, (ch.seated ? -0.31 : 0) + bob, ch.pos.z);

    if (P.bubble && now > ch.bubbleUntil) { ch.g.remove(P.bubble); disposeGroup(P.bubble); P.bubble = null; }
    P.ring.visible = hoverPid === ch.pid;
  }

  // ---------- Cámara y controles ----------
  function updateCamera() {
    cam.phi = Math.max(0.2, Math.min(1.45, cam.phi));
    cam.r = Math.max(7, Math.min(80, cam.r));
    camera.position.set(
      cam.target.x + cam.r * Math.sin(cam.phi) * Math.sin(cam.theta),
      cam.target.y + cam.r * Math.cos(cam.phi),
      cam.target.z + cam.r * Math.sin(cam.phi) * Math.cos(cam.theta));
    camera.lookAt(cam.target);
  }

  function bindControls(el) {
    const active = new Map();
    let downPos = null, moved = 0, pinch = null;
    const c = renderer.domElement;
    c.style.touchAction = "none";
    c.addEventListener("contextmenu", e => e.preventDefault());
    c.addEventListener("pointerdown", e => {
      c.setPointerCapture(e.pointerId);
      active.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
      downPos = { x: e.clientX, y: e.clientY }; moved = 0;
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
        if (pinch) { cam.r *= pinch.d / d; pan(mx - pinch.mx, my - pinch.my); }
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
      if (a && moved < 6 && downPos && e.type === "pointerup" && a.button === 0) {
        const pid = pickAt(e.clientX, e.clientY);
        if (pid && hooks.openPopover) hooks.openPopover(pid, { left: e.clientX - 20, right: e.clientX + 20, top: e.clientY - 20, bottom: e.clientY + 20, width: 40 });
      }
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener("pointerleave", () => { pointer.inside = false; hoverPid = null; });
    c.addEventListener("wheel", e => { e.preventDefault(); cam.r *= 1 + Math.sign(e.deltaY) * 0.08; }, { passive: false });
    c.style.cursor = "grab";

    function pan(dx, dy) {
      const k = cam.r * 0.0016;
      const fx = Math.sin(cam.theta), fz = Math.cos(cam.theta);     // hacia la cámara en el plano
      const rx = Math.cos(cam.theta), rz = -Math.sin(cam.theta);    // derecha
      cam.target.x -= (rx * dx - fx * dy) * k;
      cam.target.z -= (rz * dx - fz * dy) * k;
      cam.target.x = Math.max(extent.minX - 5, Math.min(extent.maxX + 5, cam.target.x));
      cam.target.z = Math.max(-14, Math.min(14, cam.target.z));
    }
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables.filter(o => o.visible && o.parent && isVisibleChain(o)), false);
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
