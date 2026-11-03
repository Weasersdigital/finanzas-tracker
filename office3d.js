// ---------- Oficina virtual: motor 3D (Three.js) ----------
// Edificio en corte con acabado realista: materiales PBR con texturas
// procedurales (madera, moqueta, hormigón, mármol, asfalto), iluminación
// física con tone mapping y reflejos de entorno, fachada de cristal, falsos
// techos con luminarias, mobiliario detallado, calle con coches y árboles,
// cielo con niebla y modo noche. Planta baja con recepción y cafetería, una
// planta por departamento (un despacho por persona), sala de reuniones en la
// última planta y ascensor de cristal para moverse entre pisos.
// Expone window.Office3D = { available, mount, unmount, sync, say, floorsList, focusFloor }.
(function () {
  "use strict";

  const O = { available: () => !!window.THREE };
  window.Office3D = O;
  if (!window.THREE) return;
  const T = THREE;

  // Medidas (metros)
  const FLOOR_H = 3.4;   // altura de cada planta (suelo a suelo)
  const BD = 7.0;        // fondo del edificio (eje z); el frente está abierto
  const CUBE_W = 3.0;    // ancho de cada despacho
  const SHAFT_W = 2.3;   // ancho del hueco del ascensor (a la izquierda)
  const SLAB = 0.35;     // grosor del forjado
  const SPEED = 1.6;     // m/s al caminar
  const LIFT_SPEED = 3.0;// m/s en el ascensor

  let container, renderer, scene, camera, statics, sun, hemi, hooks, lastData;
  let rooms = {}, floors = [], slots = {}, B = { w: 14, h: 10, aisleZ: 1.5, backZ: -BD / 2, frontZ: BD / 2 };
  let chars = new Map(), pickables = [], sig = "";
  let hoverPid = null, pointer = { x: 0, y: 0, moved: false, inside: false };
  const cam = { theta: 0.3, phi: 1.32, r: 30, target: new T.Vector3(7, 5, 0) };
  const raycaster = new T.Raycaster(), ndc = new T.Vector2();
  let TEX = null, M = null, envMap = null;

  // ---------- Utilidades ----------
  const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function disposeGroup(g) {
    g.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.map && o.material.userData.own) { o.material.map.dispose(); o.material.dispose(); }
    });
  }

  // ---------- Texturas procedurales ----------
  function canvasTex(w, h, draw, repeat, linear) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    if (!linear) t.encoding = T.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function speckle(ctx, w, h, n, alpha, light) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * alpha;
      ctx.fillStyle = light && Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  function buildTextures() {
    const wood = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#a9794a"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        const y = (i / 70) * h + Math.random() * 6;
        ctx.strokeStyle = `rgba(${60 + Math.random() * 40},${35 + Math.random() * 25},${15 + Math.random() * 10},${0.15 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 3);
        ctx.stroke();
      }
      speckle(ctx, w, h, 4000, 0.12, true);
    }, [1, 1]);
    const darkWood = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#5a3a22"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) {
        const y = (i / 90) * h;
        ctx.strokeStyle = `rgba(20,10,5,${0.1 + Math.random() * 0.3})`;
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 50 + i) * 2.5);
        ctx.stroke();
      }
      speckle(ctx, w, h, 3000, 0.15, true);
    }, [1, 1]);
    const carpet = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#9a9a9a"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 14000, 0.35, true);
    }, [6, 3], true);
    const concrete = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#b9bcc2"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 9000, 0.18, true);
      for (let i = 0; i < 25; i++) {
        ctx.strokeStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.lineWidth = 1 + Math.random() * 6;
        ctx.beginPath(); ctx.moveTo(Math.random() * w, 0); ctx.lineTo(Math.random() * w, h); ctx.stroke();
      }
    }, [2, 2], true);
    const panels = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#d9dbe0"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 5000, 0.1, true);
      ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 3;
      for (let x = 0; x <= w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 170) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }, [2, 1], true);
    const ceiling = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#f2f2ef"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 6000, 0.08, false);
      ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 3;
      for (let x = 0; x <= w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }, [4, 2]);
    const marble = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#e9e7e2"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) {
        ctx.strokeStyle = `rgba(90,90,100,${0.08 + Math.random() * 0.2})`; ctx.lineWidth = 0.5 + Math.random() * 2;
        ctx.beginPath(); let x = Math.random() * w, y = Math.random() * h; ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) { x += rnd(-80, 80); y += rnd(-80, 80); ctx.quadraticCurveTo(x + rnd(-40, 40), y + rnd(-40, 40), x, y); }
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 2;
      for (let x = 0; x <= w; x += 256) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += 256) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }, [3, 1.5]);
    const grass = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#5f9a46"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = `rgba(${40 + Math.random() * 60},${100 + Math.random() * 80},${30 + Math.random() * 40},0.5)`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3);
      }
    }, [240, 240]);
    const asphalt = canvasTex(512, 512, (ctx, w, h) => {
      ctx.fillStyle = "#3a3d43"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 12000, 0.3, true);
      ctx.fillStyle = "#e5e3d8";
      for (let x = 0; x < w; x += 128) ctx.fillRect(x, h / 2 - 5, 64, 10);
    }, [8, 1]);
    const sidewalk = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#c5c6c3"; ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 5000, 0.15, true);
      ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    }, [20, 4]);
    const screen = canvasTex(256, 160, (ctx, w, h) => {
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#1e293b"; ctx.fillRect(0, 0, w, 18); ctx.fillRect(0, 18, 54, h);
      const cols = ["#4f46e5", "#22c55e", "#f59e0b", "#ec4899", "#0ea5e9"];
      for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(64 + i * 46, 28, 38, 26); }
      for (let y = 66; y < h - 8; y += 10) { ctx.fillStyle = `rgba(148,163,184,${0.35 + Math.random() * 0.4})`; ctx.fillRect(64, y, 40 + Math.random() * 140, 4); }
      for (let y = 26; y < h - 8; y += 14) { ctx.fillStyle = "rgba(148,163,184,0.5)"; ctx.fillRect(8, y, 36, 5); }
    });
    const tv = canvasTex(512, 288, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#1d4ed8"); g.addColorStop(1, "#7c3aed");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(40, 60, 200, 14); ctx.fillRect(40, 90, 300, 10); ctx.fillRect(40, 110, 260, 10);
      [120, 200, 80, 240, 170].forEach((v, i) => { ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(60 + i * 70, h - 40 - v * 0.5, 40, v * 0.5); });
    });
    const sky = canvasTex(4, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      if (isDark()) { g.addColorStop(0, "#050816"); g.addColorStop(0.42, "#0d1730"); g.addColorStop(0.5, "#1c2540"); g.addColorStop(1, "#1c2540"); }
      else { g.addColorStop(0, "#2f74cc"); g.addColorStop(0.3, "#5f9ce6"); g.addColorStop(0.47, "#bcd8f5"); g.addColorStop(0.5, "#e6eef8"); g.addColorStop(1, "#e6eef8"); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    return { wood, darkWood, carpet, concrete, panels, ceiling, marble, grass, asphalt, sidewalk, screen, tv, sky };
  }
  function buildMaterials() {
    const S = (o) => new T.MeshStandardMaterial(o);
    return {
      wood: S({ map: TEX.wood, roughness: 0.5, metalness: 0 }),
      darkWood: S({ map: TEX.darkWood, roughness: 0.45 }),
      concrete: S({ map: TEX.concrete, roughness: 0.95, color: 0xdadde2 }),
      panels: S({ map: TEX.panels, roughness: 0.8, color: 0xf0f1f3 }),
      ceiling: S({ map: TEX.ceiling, roughness: 0.9 }),
      marble: S({ map: TEX.marble, roughness: 0.15, metalness: 0.05 }),
      grass: S({ map: TEX.grass, roughness: 1 }),
      asphalt: S({ map: TEX.asphalt, roughness: 0.95 }),
      sidewalk: S({ map: TEX.sidewalk, roughness: 0.9 }),
      metal: S({ color: 0xb8bcc4, metalness: 0.9, roughness: 0.3 }),
      darkMetal: S({ color: 0x3b3f46, metalness: 0.8, roughness: 0.4 }),
      chrome: S({ color: 0xe6e8ec, metalness: 1, roughness: 0.15 }),
      plastic: S({ color: 0x2b2f36, roughness: 0.55 }),
      whitePlastic: S({ color: 0xf4f4f2, roughness: 0.6 }),
      glass: new T.MeshPhysicalMaterial({ color: 0xcfe3f5, transparent: true, opacity: 0.28, metalness: 0, roughness: 0.05, side: T.DoubleSide, envMapIntensity: 1.5, clearcoat: 1 }),
      frosted: S({ color: 0xe8eef5, transparent: true, opacity: 0.55, roughness: 0.6 }),
      fabric: S({ color: 0x3a3f4a, roughness: 1 }),
      leather: S({ color: 0x2a2320, roughness: 0.5, metalness: 0.05 }),
      leaf: S({ color: 0x3f8f4a, roughness: 0.8, side: T.DoubleSide }),
      leafDark: S({ color: 0x2f6f3a, roughness: 0.8 }),
      trunk: S({ color: 0x5a3b22, roughness: 1 }),
      pot: S({ color: 0x8c5a3c, roughness: 0.8 }),
      lightPanel: S({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: isDark() ? 1.6 : 0.9, roughness: 0.5 }),
      screenOff: S({ color: 0x0b1220, roughness: 0.3, metalness: 0.2 }),
      paper: S({ color: 0xffffff, roughness: 0.9 }),
      mug: S({ color: 0xffffff, roughness: 0.4 }),
    };
  }
  const colorMat = new Map();
  function cmat(color, rough, metal) {
    const k = color + "/" + rough + "/" + metal;
    if (!colorMat.has(k)) colorMat.set(k, new T.MeshStandardMaterial({ color, roughness: rough == null ? 0.7 : rough, metalness: metal || 0 }));
    return colorMat.get(k);
  }
  function screenMat(color) {
    return new T.MeshStandardMaterial({ map: TEX.screen, emissiveMap: TEX.screen, emissive: new T.Color(0xffffff), emissiveIntensity: 0, roughness: 0.25, metalness: 0.1, color: 0x334155 });
  }

  // Primitivas
  function mesh(geo, material, x, y, z, parent) {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    (parent || statics).add(m);
    return m;
  }
  const box = (w, h, d, material, x, y, z, parent) => mesh(new T.BoxGeometry(w, h, d), material, x, y, z, parent);
  const cyl = (rt, rb, h, material, x, y, z, parent, seg) => mesh(new T.CylinderGeometry(rt, rb, h, seg || 24), material, x, y, z, parent);
  const sph = (r, material, x, y, z, parent, seg) => mesh(new T.SphereGeometry(r, seg || 18, seg || 14), material, x, y, z, parent);

  function plant(x, y, z, parent, big) {
    const s = big ? 1.8 : 1;
    cyl(0.17 * s, 0.13 * s, 0.32 * s, M.pot, x, y + 0.16 * s, z, parent);
    cyl(0.14 * s, 0.14 * s, 0.03, cmat(0x3b2a1a, 1), x, y + 0.32 * s, z, parent);
    const n = big ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, tilt = 0.9 + Math.random() * 0.4;
      const leaf = mesh(new T.PlaneGeometry(0.18 * s, 0.55 * s), M.leaf, x + Math.cos(a) * 0.08 * s, y + 0.55 * s, z + Math.sin(a) * 0.08 * s, parent);
      leaf.rotation.set(0, -a, tilt);
      leaf.castShadow = false;
    }
  }
  function tree(x, z, s) {
    s = s || 1;
    cyl(0.14 * s, 0.2 * s, 1.6 * s, M.trunk, x, 0.8 * s, z);
    sph(1.1 * s, M.leafDark, x, 2.3 * s, z, null, 12);
    sph(0.8 * s, M.leaf, x + 0.5 * s, 2.0 * s, z + 0.3 * s, null, 12);
    sph(0.75 * s, M.leaf, x - 0.5 * s, 2.5 * s, z - 0.2 * s, null, 12);
    sph(0.6 * s, M.leafDark, x, 3.1 * s, z + 0.4 * s, null, 12);
  }
  function car(x, z, color, rot) {
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; statics.add(g);
    const paint = cmat(color, 0.25, 0.6);
    box(4.2, 0.55, 1.8, paint, 0, 0.55, 0, g);
    const cabin = box(2.2, 0.6, 1.6, paint, -0.2, 1.1, 0, g);
    cabin.geometry.translate(0, 0, 0);
    box(2.1, 0.5, 1.62, M.glass, -0.2, 1.12, 0, g);
    box(0.3, 0.2, 1.5, cmat(0xffffff, 0.2, 0.3), 2.05, 0.6, 0, g);
    box(0.3, 0.2, 1.5, cmat(0xcc1111, 0.3), -2.05, 0.6, 0, g);
    [[1.3, 0.95], [1.3, -0.95], [-1.3, 0.95], [-1.3, -0.95]].forEach(([wx, wz]) => {
      const w = cyl(0.36, 0.36, 0.25, cmat(0x1a1a1a, 0.9), wx, 0.36, wz, g, 20); w.rotation.x = Math.PI / 2;
      const h = cyl(0.2, 0.2, 0.27, M.chrome, wx, 0.36, wz, g, 16); h.rotation.x = Math.PI / 2;
    });
  }
  function lamp(x, z) {
    cyl(0.07, 0.1, 5, M.darkMetal, x, 2.5, z);
    box(0.9, 0.08, 0.1, M.darkMetal, x + 0.4, 5, z);
    box(0.5, 0.12, 0.3, isDark() ? M.lightPanel : M.whitePlastic, x + 0.8, 4.95, z);
    if (isDark()) { const l = new T.PointLight(0xffe2a8, 0.9, 14, 2); l.position.set(x + 0.8, 4.7, z); statics.add(l); }
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
    sp.material.userData.own = true;
    const h = o.h || 0.42;
    sp.scale.set(h * c.width / c.height, h, 1);
    sp.renderOrder = 10;
    return sp;
  }

  // ---------- Montaje ----------
  O.mount = function (el, h) {
    hooks = h || {};
    if (container === el) return;
    container = el;
    el.innerHTML = "";
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);
    const help = document.createElement("div");
    help.className = "office-3d-help";
    help.textContent = "Arrastra para girar · Rueda o pellizco para zoom · Botón derecho para subir y bajar";
    el.appendChild(help);

    scene = new T.Scene();
    camera = new T.PerspectiveCamera(30, 1, 0.1, 600);
    hemi = new T.HemisphereLight(0xcfe3ff, 0x5a6a50, 0.6);
    scene.add(hemi);
    sun = new T.DirectionalLight(0xfff1dc, 1.8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    statics = new T.Group();
    scene.add(statics);
    setupEnvironment();

    bindControls(el);
    new ResizeObserver(resize).observe(el);
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { setupEnvironment(); if (lastData) rebuild(lastData, true); });
    resize();
    requestAnimationFrame(loop);
  };

  // Cielo, niebla y mapa de entorno para los reflejos
  function setupEnvironment() {
    TEX = buildTextures();
    M = buildMaterials();
    const dark = isDark();
    const skyScene = new T.Scene();
    const skyDome = new T.Mesh(new T.SphereGeometry(300, 32, 16), new T.MeshBasicMaterial({ map: TEX.sky, side: T.BackSide }));
    skyScene.add(skyDome);
    const groundDisc = new T.Mesh(new T.CircleGeometry(300, 32), new T.MeshBasicMaterial({ color: dark ? 0x101410 : 0x6a9a50 }));
    groundDisc.rotation.x = -Math.PI / 2; groundDisc.position.y = -2; skyScene.add(groundDisc);
    const pmrem = new T.PMREMGenerator(renderer);
    if (envMap) envMap.dispose();
    envMap = pmrem.fromScene(skyScene, 0.04).texture;
    pmrem.dispose();
    scene.environment = envMap;
    scene.background = new T.Mesh(new T.SphereGeometry(400, 32, 16), new T.MeshBasicMaterial({ map: TEX.sky, side: T.BackSide, fog: false }));
    scene.children.filter(o => o.userData.sky).forEach(o => scene.remove(o));
    const bg = new T.Mesh(new T.SphereGeometry(400, 32, 16), new T.MeshBasicMaterial({ map: TEX.sky, side: T.BackSide, fog: false }));
    bg.userData.sky = true; scene.add(bg);
    scene.background = null;
    scene.fog = new T.Fog(dark ? 0x1c2540 : 0xe6eef8, 80, 320);
    hemi.intensity = dark ? 0.18 : 0.6;
    hemi.color.set(dark ? 0x334466 : 0xcfe3ff);
    sun.intensity = dark ? 0.25 : 1.8;
    sun.color.set(dark ? 0x9fb4ff : 0xfff1dc);
    renderer.toneMappingExposure = dark ? 0.95 : 1.05;
    Object.values(M).forEach(m => { if (m.isMeshStandardMaterial && m.envMapIntensity == null) m.envMapIntensity = 0.6; });
  }

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
    B.w = Math.max(14, SHAFT_W + 0.8 + maxN * CUBE_W + 0.6);
    B.backZ = -BD / 2; B.frontZ = BD / 2; B.aisleZ = 1.5;
    B.lobbyX = SHAFT_W + 1.3;
    B.exitZ = BD / 2 + 3.0;
    const deskZ = B.backZ + 1.1, seatZ = B.backZ + 1.95, visitZ = B.backZ + 2.9;

    const addFloor = (id, label, color) => {
      const i = floors.length;
      const r = { id, floor: i, y0: i * FLOOR_H, label, color, spots: [], cubicles: [], cooler: { x: SHAFT_W + 1.0, z: B.backZ + 1.2, face: Math.PI } };
      rooms[id] = r; floors.push(r);
      return r;
    };

    const lobby = addFloor("lobby", "🏢 Recepción y cafetería", "#d97706");
    lobby.tables = [{ x: B.w - 3.4, z: 0.6 }, { x: B.w - 6.8, z: 0.6 }];
    lobby.tables.forEach(t => {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const x = t.x + Math.cos(a) * 1.0, z = t.z + Math.sin(a) * 1.0;
        lobby.spots.push({ x, z, face: Math.atan2(t.x - x, t.z - z) });
      }
    });
    lobby.spots.push({ x: B.w - 4.2, z: B.backZ + 1.5, face: Math.PI });
    lobby.spots.push({ x: B.w - 5.4, z: B.backZ + 1.5, face: Math.PI });

    data.departments.forEach(d => {
      const members = data.people.filter(p => p.deptId === d.id);
      const r = addFloor(d.id, `${d.emoji} ${d.name}`, d.color);
      r.dept = d;
      r.cubicles = members.map((p, j) => ({
        pid: p.id, name: p.name, roomId: d.id,
        x: SHAFT_W + 0.8 + j * CUBE_W + CUBE_W / 2, deskZ, seatZ, visitZ, face: Math.PI,
      }));
    });

    const m = addFloor("meeting", "🗣️ Sala de reuniones", "#7c3aed");
    m.center = { x: SHAFT_W + 0.8 + (B.w - SHAFT_W - 1.4) / 2, z: -0.3 };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const x = m.center.x + Math.cos(a) * 2.7, z = m.center.z + Math.sin(a) * 1.6;
      m.spots.push({ x, z, face: Math.atan2(m.center.x - x, m.center.z - z), seat: true });
    }

    B.h = floors.length * FLOOR_H;
    fitCamera();
  }

  // ---------- Mobiliario ----------
  function deskSet(c, y0, deptColor, j) {
    const x = c.x, dz = c.deskZ;
    // Mesa con tablero de madera y patas metálicas
    box(1.7, 0.05, 0.8, M.wood, x, y0 + 0.74, dz);
    [[-0.78, -0.33], [0.78, -0.33], [-0.78, 0.33], [0.78, 0.33]].forEach(([lx, lz]) => cyl(0.025, 0.025, 0.72, M.darkMetal, x + lx, y0 + 0.36, dz + lz));
    box(1.5, 0.03, 0.08, M.darkMetal, x, y0 + 0.62, dz - 0.3); // bandeja de cables
    // Monitor con pantalla iluminada
    cyl(0.14, 0.17, 0.02, M.darkMetal, x, y0 + 0.78, dz);
    cyl(0.025, 0.025, 0.22, M.darkMetal, x, y0 + 0.88, dz);
    box(0.76, 0.46, 0.035, M.plastic, x, y0 + 1.19, dz);
    c.screen = mesh(new T.PlaneGeometry(0.7, 0.4), screenMat(), x, y0 + 1.19, dz + 0.02);
    c.screen.castShadow = false;
    // Teclado, ratón, taza, papeles, portátil
    box(0.46, 0.02, 0.16, M.plastic, x, y0 + 0.775, dz + 0.24);
    box(0.06, 0.02, 0.09, M.plastic, x + 0.33, y0 + 0.775, dz + 0.26);
    cyl(0.045, 0.04, 0.09, M.mug, x - 0.55, y0 + 0.81, dz + 0.15);
    const papers = box(0.28, 0.01, 0.2, M.paper, x + 0.55, y0 + 0.77, dz - 0.05); papers.rotation.y = 0.3;
    if (j % 3 === 1) { box(0.34, 0.015, 0.24, M.metal, x + 0.55, y0 + 0.775, dz + 0.1); const lid = box(0.34, 0.22, 0.012, M.metal, x + 0.55, y0 + 0.89, dz - 0.02); lid.rotation.x = -0.25; }
    // Silla de oficina: base de estrella, pistón, asiento y respaldo acolchados
    const sx = x, sz = c.seatZ;
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const leg = box(0.32, 0.03, 0.05, M.darkMetal, sx + Math.cos(a) * 0.16, y0 + 0.04, sz + Math.sin(a) * 0.16); leg.rotation.y = -a;
      sph(0.03, M.plastic, sx + Math.cos(a) * 0.3, y0 + 0.03, sz + Math.sin(a) * 0.3, null, 8);
    }
    cyl(0.03, 0.03, 0.4, M.chrome, sx, y0 + 0.25, sz);
    const seat = cyl(0.27, 0.25, 0.09, M.fabric, sx, y0 + 0.47, sz, null, 28);
    seat.scale.z = 0.95;
    box(0.46, 0.5, 0.07, M.fabric, sx, y0 + 0.8, sz + 0.24);
    box(0.4, 0.14, 0.05, M.fabric, sx, y0 + 1.1, sz + 0.26);
    box(0.04, 0.03, 0.3, M.plastic, sx - 0.25, y0 + 0.7, sz + 0.05); box(0.04, 0.03, 0.3, M.plastic, sx + 0.25, y0 + 0.7, sz + 0.05);
    // Placa con el nombre y extras
    const plate = textSprite(c.name, { size: 24, h: 0.28, bg: "rgba(255,255,255,0.9)", color: "#14161a", weight: 600 });
    plate.position.set(x + 0.62, y0 + 0.95, dz + 0.3); statics.add(plate);
    if (j % 2 === 0) plant(x + 1.25, y0, dz - 0.1);
    else { box(0.42, 0.72, 0.5, M.whitePlastic, x - 1.2, y0 + 0.36, dz); box(0.36, 0.02, 0.02, M.chrome, x - 1.2, y0 + 0.55, dz + 0.26); box(0.36, 0.02, 0.02, M.chrome, x - 1.2, y0 + 0.25, dz + 0.26); }
  }
  function loungeChair(x, y0, z, face, material) {
    const g = new T.Group(); g.position.set(x, y0, z); g.rotation.y = face; statics.add(g);
    cyl(0.03, 0.03, 0.42, M.chrome, 0, 0.21, 0, g);
    cyl(0.25, 0.25, 0.04, M.darkMetal, 0, 0.03, 0, g);
    const seat = box(0.52, 0.09, 0.5, material, 0, 0.47, 0, g);
    box(0.5, 0.5, 0.08, material, 0, 0.78, -0.23, g);
    box(0.06, 0.04, 0.34, material, -0.26, 0.68, -0.02, g); box(0.06, 0.04, 0.34, material, 0.26, 0.68, -0.02, g);
    return seat;
  }
  function cafeTable(t, y0) {
    cyl(0.62, 0.62, 0.05, M.wood, t.x, y0 + 0.74, t.z, null, 32);
    cyl(0.04, 0.04, 0.7, M.chrome, t.x, y0 + 0.37, t.z);
    cyl(0.3, 0.3, 0.03, M.darkMetal, t.x, y0 + 0.02, t.z);
    cyl(0.045, 0.04, 0.09, M.mug, t.x + 0.25, y0 + 0.81, t.z - 0.1);
    cyl(0.045, 0.04, 0.09, M.mug, t.x - 0.2, y0 + 0.81, t.z + 0.2);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const sx = t.x + Math.cos(a) * 1.0, sz = t.z + Math.sin(a) * 1.0;
      cyl(0.18, 0.18, 0.05, M.wood, sx, y0 + 0.46, sz, null, 20);
      cyl(0.025, 0.025, 0.45, M.chrome, sx, y0 + 0.22, sz);
      cyl(0.15, 0.15, 0.02, M.darkMetal, sx, y0 + 0.01, sz);
    }
  }

  // ---------- Construcción de la escena estática ----------
  function rebuild(data, keepPositions) {
    statics.children.slice().forEach(ch => { statics.remove(ch); disposeGroup(ch); });
    computeLayout(data);
    const dark = isDark();

    // Terreno, calle, acera, coches, farolas y árboles
    const ground = mesh(new T.PlaneGeometry(1600, 1600), M.grass, B.w / 2, -SLAB - 0.05, 0);
    ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
    const road = mesh(new T.PlaneGeometry(120, 7), M.asphalt, B.w / 2, -SLAB - 0.03, B.frontZ + 11);
    road.rotation.x = -Math.PI / 2; road.castShadow = false;
    const walk = box(B.w + 12, 0.15, 6.5, M.sidewalk, B.w / 2, -SLAB - 0.07, B.frontZ + 4.2); walk.castShadow = false;
    box(B.w + 12, 0.15, 0.3, M.concrete, B.w / 2, -SLAB - 0.07, B.frontZ + 7.55).castShadow = false;
    const walk2 = box(120, 0.15, 3, M.sidewalk, B.w / 2, -SLAB - 0.07, B.frontZ + 16); walk2.castShadow = false;
    car(B.w / 2 - 6, B.frontZ + 9.3, 0xb91c1c, 0); car(B.w / 2 + 2, B.frontZ + 9.3, 0x1e3a8a, 0); car(B.w / 2 + 10, B.frontZ + 12.7, 0xe5e7eb, Math.PI);
    lamp(-1.5, B.frontZ + 6.6); lamp(B.w + 1.5, B.frontZ + 6.6); lamp(B.w / 2, B.frontZ + 6.6);
    tree(-4.5, 1, 1.3); tree(B.w + 4.5, 0, 1.1); tree(B.w + 6, -5, 1.4); tree(-6, -5, 1.0); tree(-8, B.frontZ + 18, 1.2); tree(B.w + 8, B.frontZ + 19, 1.1);
    tree(B.w / 2 - 5, B.frontZ + 19, 1.0); tree(B.w / 2 + 6, B.frontZ + 18.5, 1.3);
    [[-2.2, B.frontZ + 1.8], [B.w + 2.2, B.frontZ + 1.8]].forEach(([x, z]) => { box(1.6, 0.5, 1.0, M.concrete, x, -SLAB + 0.25, z); sph(0.55, M.leafDark, x, -SLAB + 0.8, z, null, 10); sph(0.4, M.leaf, x + 0.4, -SLAB + 0.75, z + 0.2, null, 10); });
    // Zócalo del edificio
    box(B.w + 0.8, SLAB + 0.3, BD + 0.8, M.concrete, B.w / 2, -SLAB / 2 - 0.15, 0).castShadow = false;

    // Estructura por plantas
    floors.forEach(r => {
      const y0 = r.y0;
      const slab = box(B.w, SLAB, BD, M.concrete, B.w / 2, y0 - SLAB / 2, 0);
      slab.castShadow = r.floor > 0;
      // Suelo: mármol en el vestíbulo, moqueta tintada en el resto
      let floorMat;
      if (r.id === "lobby") floorMat = M.marble;
      else { floorMat = new T.MeshStandardMaterial({ map: TEX.carpet, roughness: 1, color: new T.Color(r.color).lerp(new T.Color(0xffffff), 0.55) }); }
      const fl = mesh(new T.PlaneGeometry(B.w, BD), floorMat, B.w / 2, y0 + 0.005, 0);
      fl.rotation.x = -Math.PI / 2; fl.castShadow = false;
      // Falso techo con luminarias
      const ceil = mesh(new T.PlaneGeometry(B.w, BD), M.ceiling, B.w / 2, y0 + FLOOR_H - SLAB - 0.005, 0);
      ceil.rotation.x = Math.PI / 2; ceil.castShadow = false;
      const nLights = Math.max(2, Math.round(B.w / 4.5));
      for (let i = 0; i < nLights; i++) {
        const lx = SHAFT_W + 0.5 + ((i + 0.5) / nLights) * (B.w - SHAFT_W - 0.5);
        box(1.2, 0.04, 0.6, M.lightPanel, lx, y0 + FLOOR_H - SLAB - 0.03, -0.6).castShadow = false;
        box(1.2, 0.04, 0.6, M.lightPanel, lx, y0 + FLOOR_H - SLAB - 0.03, 1.6).castShadow = false;
      }
      const pl = new T.PointLight(0xfff2dc, dark ? 1.1 : 0.55, 16, 2);
      pl.position.set(B.w / 2 + 1, y0 + FLOOR_H - 0.8, 0.3); statics.add(pl);
      // Fachada trasera de cristal con montantes; laterales de panel
      const back = box(B.w, FLOOR_H - SLAB, 0.06, M.glass, B.w / 2, y0 + (FLOOR_H - SLAB) / 2, B.backZ - 0.03);
      back.castShadow = false;
      box(B.w, 0.12, 0.16, M.darkMetal, B.w / 2, y0 + 1.05, B.backZ - 0.05).castShadow = false;
      for (let x = 0; x <= B.w + 0.01; x += 2.4) box(0.1, FLOOR_H - SLAB, 0.16, M.darkMetal, Math.min(x, B.w), y0 + (FLOOR_H - SLAB) / 2, B.backZ - 0.05).castShadow = false;
      box(B.w, 0.8, 0.16, M.panels, B.w / 2, y0 + 0.4, B.backZ - 0.05).castShadow = false; // antepecho
      box(0.3, FLOOR_H - SLAB, BD, M.panels, -0.15, y0 + (FLOOR_H - SLAB) / 2, 0).castShadow = false;
      box(0.3, FLOOR_H - SLAB, BD, M.panels, B.w + 0.15, y0 + (FLOOR_H - SLAB) / 2, 0).castShadow = false;
      box(B.w, 0.1, 0.02, cmat(0x2b2f36, 0.6), B.w / 2, y0 + 0.05, B.backZ + 0.08).castShadow = false; // rodapié
      // Canto del forjado en el frente, barandilla de cristal y pilares
      box(B.w, SLAB, 0.1, M.darkMetal, B.w / 2, y0 - SLAB / 2, B.frontZ + 0.05).castShadow = false;
      box(B.w, 0.06, 0.1, cmat(r.color, 0.4, 0.2), B.w / 2, y0 - SLAB - 0.05, B.frontZ + 0.08).castShadow = false;
      const rail = box(B.w, 1.0, 0.03, M.glass, B.w / 2, y0 + 0.5, B.frontZ - 0.06); rail.castShadow = false;
      box(B.w, 0.05, 0.08, M.chrome, B.w / 2, y0 + 1.02, B.frontZ - 0.06).castShadow = false;
      for (let x = SHAFT_W + 0.4; x < B.w - 0.5; x += 6.0) cyl(0.18, 0.18, FLOOR_H - SLAB, M.concrete, x, y0 + (FLOOR_H - SLAB) / 2, B.frontZ - 0.45);
      const sign = textSprite(r.label, { size: 32, h: 0.6, bg: r.color, color: "#fff" });
      sign.position.set(B.w + 1.1, y0 + 1.7, 0); statics.add(sign);
      // Pared del hueco del ascensor con puertas metálicas
      box(0.14, FLOOR_H - SLAB, BD / 2 - 1.0, M.panels, SHAFT_W, y0 + (FLOOR_H - SLAB) / 2, B.backZ + (BD / 2 - 1.0) / 2).castShadow = false;
      box(0.14, FLOOR_H - SLAB, BD / 2 - 1.4, M.panels, SHAFT_W, y0 + (FLOOR_H - SLAB) / 2, B.frontZ - (BD / 2 - 1.4) / 2).castShadow = false;
      box(0.14, 0.7, 2.4, M.panels, SHAFT_W, y0 + FLOOR_H - SLAB - 0.35, 0.2).castShadow = false;
      box(0.06, 2.3, 2.3, M.chrome, SHAFT_W + 0.07, y0 + 1.15, 0.2).castShadow = false; // marco
      box(0.04, 0.5, 0.3, M.plastic, SHAFT_W + 0.09, y0 + 1.3, 1.6).castShadow = false; // botonera
      // Fuente de agua
      box(0.42, 0.95, 0.42, M.whitePlastic, SHAFT_W + 0.45, y0 + 0.475, B.backZ + 0.5);
      cyl(0.17, 0.17, 0.42, new T.MeshPhysicalMaterial({ color: 0x8ec5ff, transparent: true, opacity: 0.55, roughness: 0.1 }), SHAFT_W + 0.45, y0 + 1.16, B.backZ + 0.5);

      if (r.cubicles.length) {
        r.cubicles.forEach((c, j) => {
          if (j > 0) {
            const px = SHAFT_W + 0.8 + j * CUBE_W;
            box(0.05, 1.3, 2.8, M.frosted, px, y0 + 0.65, B.backZ + 1.4);
            box(0.07, 0.04, 2.8, M.chrome, px, y0 + 1.31, B.backZ + 1.4); box(0.07, 1.3, 0.04, M.chrome, px, y0 + 0.65, B.backZ + 2.8);
          }
          deskSet(c, y0, r.color, j);
        });
        if (r.cubicles.length <= 4) plant(B.w - 0.7, y0, B.frontZ - 0.9, null, true);
      } else if (r.id === "meeting") {
        const table = box(5.2, 0.06, 2.1, M.darkWood, r.center.x, y0 + 0.74, r.center.z);
        box(4.6, 0.68, 1.4, M.darkWood, r.center.x, y0 + 0.36, r.center.z);
        box(1.0, 0.02, 0.6, M.metal, r.center.x - 1.2, y0 + 0.78, r.center.z); box(1.0, 0.02, 0.6, M.metal, r.center.x + 1.2, y0 + 0.78, r.center.z);
        r.spots.forEach(s => loungeChair(s.x, y0, s.z, s.face, M.leather));
        box(2.8, 1.6, 0.06, M.plastic, r.center.x, y0 + 1.8, B.backZ + 0.12);
        const tvs = mesh(new T.PlaneGeometry(2.7, 1.5), new T.MeshStandardMaterial({ map: TEX.tv, emissiveMap: TEX.tv, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3 }), r.center.x, y0 + 1.8, B.backZ + 0.16);
        tvs.castShadow = false;
        box(1.8, 1.1, 0.04, M.whitePlastic, B.w - 2.0, y0 + 1.55, B.backZ + 0.12); box(1.86, 1.16, 0.03, M.metal, B.w - 2.0, y0 + 1.55, B.backZ + 0.1);
        plant(B.w - 0.7, y0, B.frontZ - 0.9, null, true); plant(SHAFT_W + 0.9, y0, B.frontZ - 0.9, null, true);
        box(0.6, 0.06, 0.4, M.metal, r.center.x, y0 + 0.78, r.center.z + 0.5); // proyector / altavoz
      } else if (r.id === "lobby") {
        // Mostrador de recepción curvo (segmento de cilindro) con tablero
        const counter = mesh(new T.CylinderGeometry(1.6, 1.6, 1.05, 32, 1, false, Math.PI * 0.15, Math.PI * 0.7), M.darkWood, SHAFT_W + 3.4, y0 + 0.525, B.backZ + 1.6);
        counter.rotation.y = Math.PI;
        const top = mesh(new T.CylinderGeometry(1.7, 1.7, 0.06, 32, 1, false, Math.PI * 0.15, Math.PI * 0.7), M.marble, SHAFT_W + 3.4, y0 + 1.08, B.backZ + 1.6);
        top.rotation.y = Math.PI;
        box(0.5, 0.32, 0.03, M.plastic, SHAFT_W + 3.0, y0 + 1.28, B.backZ + 0.9); cyl(0.04, 0.04, 0.1, M.mug, SHAFT_W + 3.7, y0 + 1.14, B.backZ + 1.0);
        box(3.6, 0.9, 0.08, M.darkWood, SHAFT_W + 3.4, y0 + 1.9, B.backZ + 0.12);
        const logo = textSprite("Oficina virtual", { size: 30, h: 0.5, bg: "rgba(20,22,26,0.9)", color: "#fff" });
        logo.position.set(SHAFT_W + 3.4, y0 + 1.9, B.backZ + 0.2); statics.add(logo);
        // Zona de espera: sofás, mesita y plantas grandes
        const sofa = (sx, sz, rot) => { const g = new T.Group(); g.position.set(sx, y0, sz); g.rotation.y = rot; statics.add(g);
          box(2.0, 0.42, 0.9, cmat(0x4f46e5, 0.9), 0, 0.3, 0, g); box(2.0, 0.55, 0.22, cmat(0x4338ca, 0.9), 0, 0.72, -0.34, g);
          box(0.22, 0.3, 0.9, cmat(0x4338ca, 0.9), -0.89, 0.6, 0, g); box(0.22, 0.3, 0.9, cmat(0x4338ca, 0.9), 0.89, 0.6, 0, g);
          [[-0.8, 0.3], [0.8, 0.3], [-0.8, -0.3], [0.8, -0.3]].forEach(([lx, lz]) => cyl(0.03, 0.03, 0.12, M.darkMetal, lx, 0.06, lz, g)); };
        sofa(SHAFT_W + 3.0, B.frontZ - 1.1, 0); sofa(SHAFT_W + 6.0, B.frontZ - 2.4, Math.PI);
        box(0.9, 0.04, 0.6, M.glass, SHAFT_W + 4.5, y0 + 0.42, B.frontZ - 1.8); box(0.8, 0.02, 0.5, M.darkMetal, SHAFT_W + 4.5, y0 + 0.4, B.frontZ - 1.8);
        [[-0.4, 0.25], [0.4, 0.25], [-0.4, -0.25], [0.4, -0.25]].forEach(([lx, lz]) => cyl(0.02, 0.02, 0.4, M.chrome, SHAFT_W + 4.5 + lx, y0 + 0.2, B.frontZ - 1.8 + lz));
        plant(SHAFT_W + 1.0, y0, B.frontZ - 1.0, null, true); plant(SHAFT_W + 7.4, y0, B.backZ + 0.8, null, true);
        // Cafetería: barra, máquina de café, vitrina, nevera y taburetes
        box(3.4, 0.98, 0.75, M.darkWood, B.w - 4.8, y0 + 0.49, B.backZ + 0.75);
        box(3.5, 0.05, 0.85, M.marble, B.w - 4.8, y0 + 1.01, B.backZ + 0.75);
        box(0.55, 0.5, 0.45, M.chrome, B.w - 5.9, y0 + 1.28, B.backZ + 0.75); box(0.5, 0.1, 0.4, M.plastic, B.w - 5.9, y0 + 1.58, B.backZ + 0.75);
        box(0.9, 0.42, 0.5, M.glass, B.w - 4.6, y0 + 1.25, B.backZ + 0.75); box(0.86, 0.02, 0.46, M.metal, B.w - 4.6, y0 + 1.05, B.backZ + 0.75);
        for (let i = 0; i < 4; i++) sph(0.07, cmat(i % 2 ? 0xd97706 : 0xf5deb3, 0.8), B.w - 4.95 + i * 0.22, y0 + 1.14, B.backZ + 0.72, null, 8);
        box(0.85, 1.9, 0.72, M.metal, B.w - 1.3, y0 + 0.95, B.backZ + 0.75); box(0.02, 1.2, 0.03, M.darkMetal, B.w - 0.86, y0 + 1.0, B.backZ + 1.12);
        [B.w - 6.2, B.w - 5.3, B.w - 4.4, B.w - 3.5].forEach(sx => { cyl(0.18, 0.18, 0.06, M.leather, sx, y0 + 0.72, B.backZ + 1.65, null, 20); cyl(0.025, 0.025, 0.7, M.chrome, sx, y0 + 0.35, B.backZ + 1.65); cyl(0.17, 0.17, 0.02, M.darkMetal, sx, y0 + 0.01, B.backZ + 1.65); });
        for (let i = 0; i < 3; i++) { cyl(0.012, 0.012, 1.0, M.darkMetal, B.w - 5.8 + i * 1.0, y0 + FLOOR_H - SLAB - 0.5, B.backZ + 0.75); cyl(0.16, 0.08, 0.2, M.darkMetal, B.w - 5.8 + i * 1.0, y0 + FLOOR_H - SLAB - 1.05, B.backZ + 0.75); }
        r.tables.forEach(t => cafeTable(t, y0));
        const caf = textSprite("☕ Cafetería", { size: 24, h: 0.34, bg: "rgba(217,119,6,0.95)", color: "#fff" });
        caf.position.set(B.w - 4.8, y0 + 2.2, B.backZ + 0.75); statics.add(caf);
        // Entrada: puertas de cristal con marco y marquesina
        box(0.14, 2.6, 0.14, M.darkMetal, B.w / 2 - 1.3, y0 + 1.3, B.frontZ); box(0.14, 2.6, 0.14, M.darkMetal, B.w / 2 + 1.3, y0 + 1.3, B.frontZ);
        box(2.74, 0.14, 0.14, M.darkMetal, B.w / 2, y0 + 2.6, B.frontZ);
        box(1.2, 2.5, 0.04, M.glass, B.w / 2 - 0.65, y0 + 1.28, B.frontZ).castShadow = false; box(1.2, 2.5, 0.04, M.glass, B.w / 2 + 0.65, y0 + 1.28, B.frontZ).castShadow = false;
        box(0.03, 0.5, 0.03, M.chrome, B.w / 2 - 0.1, y0 + 1.1, B.frontZ + 0.05); box(0.03, 0.5, 0.03, M.chrome, B.w / 2 + 0.1, y0 + 1.1, B.frontZ + 0.05);
        box(3.6, 0.12, 1.6, M.darkMetal, B.w / 2, y0 + 2.75, B.frontZ + 0.8);
        box(B.w, 0.3, 0.1, M.panels, B.w / 2, y0 + 1.2, B.frontZ - 0.06).castShadow = false;
        const ent = textSprite("🚪 Entrada", { size: 26, h: 0.44, bg: "rgba(55,65,81,0.95)", color: "#fff" });
        ent.position.set(B.w / 2, y0 + 3.1, B.frontZ + 0.8); statics.add(ent);
      }
    });

    // Hueco del ascensor: cristal frontal, guías y rótulo
    const glass = mesh(new T.BoxGeometry(SHAFT_W - 0.2, B.h, 0.05), M.glass, SHAFT_W / 2, B.h / 2, B.frontZ - 1.3);
    glass.castShadow = false;
    box(0.12, B.h, 0.12, M.darkMetal, 0.35, B.h / 2, B.backZ + 0.35).castShadow = false;
    box(0.12, B.h, 0.12, M.darkMetal, SHAFT_W - 0.35, B.h / 2, B.backZ + 0.35).castShadow = false;
    const liftSign = textSprite("🛗 Ascensor", { size: 24, h: 0.4, bg: "rgba(55,65,81,0.95)", color: "#fff" });
    liftSign.position.set(SHAFT_W / 2, B.h + 0.6, 0); statics.add(liftSign);

    // Azotea: cubierta de grava, peto, climatizadores, depósito y antena
    box(B.w + 0.4, SLAB, BD + 0.4, M.concrete, B.w / 2, B.h - SLAB / 2, 0);
    const gravel = mesh(new T.PlaneGeometry(B.w, BD), new T.MeshStandardMaterial({ map: TEX.concrete, roughness: 1, color: 0x9a9da3 }), B.w / 2, B.h + 0.01, 0);
    gravel.rotation.x = -Math.PI / 2; gravel.castShadow = false;
    box(0.2, 1.0, BD + 0.4, M.panels, -0.1, B.h + 0.5, 0); box(0.2, 1.0, BD + 0.4, M.panels, B.w + 0.1, B.h + 0.5, 0);
    box(B.w + 0.4, 1.0, 0.2, M.panels, B.w / 2, B.h + 0.5, B.backZ - 0.1);
    box(B.w + 0.4, 0.05, 0.1, M.chrome, B.w / 2, B.h + 1.0, B.frontZ + 0.1); for (let x = 0; x <= B.w; x += 2) cyl(0.02, 0.02, 1.0, M.chrome, x, B.h + 0.5, B.frontZ + 0.1);
    [B.w - 2.6, B.w - 4.6].forEach(x => { box(1.4, 0.9, 1.1, M.metal, x, B.h + 0.45, -1.4); box(1.0, 0.04, 0.8, M.darkMetal, x, B.h + 0.92, -1.4); cyl(0.35, 0.35, 0.06, M.darkMetal, x, B.h + 0.95, -1.4); });
    cyl(0.9, 0.9, 1.3, M.whitePlastic, SHAFT_W + 2.0, B.h + 0.65, -1.5); cyl(0.95, 0.95, 0.1, M.darkMetal, SHAFT_W + 2.0, B.h + 1.3, -1.5);
    cyl(0.04, 0.06, 3.0, M.darkMetal, B.w - 1.2, B.h + 1.5, -2.4); sph(0.08, new T.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff2222, emissiveIntensity: 2 }), B.w - 1.2, B.h + 3.05, -2.4, null, 8);
    box(0.6, 0.6, 0.6, M.metal, B.w - 1.2, B.h + 0.3, -2.4);
    box(1.6, 0.9, 0.8, M.panels, SHAFT_W + 0.3, B.h + 0.45, 0.6); // salida de escalera

    // Luz solar y sombras
    sun.position.set(B.w / 2 + 22, B.h + 28, 30);
    sun.target.position.set(B.w / 2, B.h / 2, 0);
    scene.add(sun.target);
    const sc = sun.shadow.camera, half = Math.max(B.w, B.h) * 0.85 + 8;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 160;
    sc.updateProjectionMatrix();

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
    const skin = cmat(p.skin, 0.65), shirt = cmat(p.shirt, 0.85), hair = cmat(p.hair, 0.6), pants = cmat(0x2f3542, 0.9), shoe = cmat(0x1a1a1a, 0.5);
    const mk = (geo, m, x, y, z, parent) => { const b = new T.Mesh(geo, m); b.position.set(x, y, z); b.castShadow = true; (parent || g).add(b); return b; };

    const legL = new T.Group(), legR = new T.Group();
    legL.position.set(-0.13, 0.78, 0); legR.position.set(0.13, 0.78, 0);
    [legL, legR].forEach(l => {
      mk(new T.CylinderGeometry(0.1, 0.085, 0.76, 14), pants, 0, -0.38, 0, l);
      mk(new T.SphereGeometry(0.1, 10, 8), pants, 0, 0, 0, l);
      mk(new T.BoxGeometry(0.19, 0.08, 0.32), shoe, 0, -0.78, 0.05, l);
    });
    g.add(legL, legR);

    const torso = mk(new T.CylinderGeometry(0.27, 0.22, 0.72, 18), shirt, 0, 1.14, 0);
    torso.scale.z = 0.72;
    mk(new T.SphereGeometry(0.27, 18, 12), shirt, 0, 1.46, 0).scale.set(1, 0.45, 0.72); // hombros
    mk(new T.CylinderGeometry(0.07, 0.08, 0.12, 12), skin, 0, 1.55, 0); // cuello
    const armL = new T.Group(), armR = new T.Group();
    armL.position.set(-0.33, 1.48, 0); armR.position.set(0.33, 1.48, 0);
    [armL, armR].forEach(a => {
      mk(new T.SphereGeometry(0.09, 10, 8), shirt, 0, 0, 0, a);
      mk(new T.CylinderGeometry(0.075, 0.065, 0.62, 12), shirt, 0, -0.3, 0, a);
      mk(new T.SphereGeometry(0.07, 10, 8), skin, 0, -0.64, 0, a);
    });
    const cup = mk(new T.CylinderGeometry(0.045, 0.04, 0.1, 12), M.mug, 0, -0.7, 0.08, armR);
    cup.visible = false;
    g.add(armL, armR);

    const head = new T.Group();
    head.position.set(0, 1.6, 0);
    mk(new T.SphereGeometry(0.23, 20, 16), skin, 0, 0.2, 0, head).scale.set(1, 1.1, 1);
    mk(new T.SphereGeometry(0.03, 8, 6), cmat(0x111827, 0.3), -0.085, 0.22, 0.2, head);
    mk(new T.SphereGeometry(0.03, 8, 6), cmat(0x111827, 0.3), 0.085, 0.22, 0.2, head);
    const nose = mk(new T.SphereGeometry(0.03, 8, 6), skin, 0, 0.14, 0.23, head);
    mk(new T.BoxGeometry(0.1, 0.015, 0.02), cmat(0x9f3b3b, 0.6), 0, 0.07, 0.215, head);
    mk(new T.SphereGeometry(0.035, 8, 6), skin, -0.22, 0.18, 0, head); mk(new T.SphereGeometry(0.035, 8, 6), skin, 0.22, 0.18, 0, head);
    const style = p.hairStyle || "short";
    if (style !== "bald") { const cap = mk(new T.SphereGeometry(0.245, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair, 0, 0.21, -0.01, head); cap.scale.set(1, 1.1, 1); }
    if (style === "long") mk(new T.CylinderGeometry(0.24, 0.2, 0.5, 16, 1, false, 0, Math.PI), hair, 0, 0.0, -0.02, head).rotation.y = Math.PI / 2;
    if (style === "bun") mk(new T.SphereGeometry(0.11, 12, 10), hair, 0, 0.5, -0.1, head);
    if (style === "curly") { const b = mk(new T.SphereGeometry(0.3, 16, 12), hair, 0, 0.3, -0.02, head); b.scale.set(1.05, 0.75, 1.05); }
    g.add(head);

    const ring = new T.Mesh(new T.RingGeometry(0.42, 0.55, 32), new T.MeshBasicMaterial({ color: 0x4f46e5, side: T.DoubleSide, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false;
    g.add(ring);

    const cab = new T.Group();
    const cabFloor = new T.Mesh(new T.BoxGeometry(1.5, 0.12, 1.5), M.metal); cabFloor.position.y = -0.06; cab.add(cabFloor);
    const cabGlass = new T.Mesh(new T.BoxGeometry(1.5, 2.4, 1.5), M.glass); cabGlass.position.y = 1.2; cab.add(cabGlass);
    const cabTop = new T.Mesh(new T.BoxGeometry(1.5, 0.1, 1.5), M.darkMetal); cabTop.position.y = 2.45; cab.add(cabTop);
    [[-0.74, -0.74], [0.74, -0.74], [-0.74, 0.74], [0.74, 0.74]].forEach(([x, z]) => { const e = new T.Mesh(new T.BoxGeometry(0.05, 2.4, 0.05), M.chrome); e.position.set(x, 1.2, z); cab.add(e); });
    cab.visible = false;
    g.add(cab);

    return {
      pid: p.id, g, parts: { legL, legR, armL, armR, head, cup, ring, cab, label: null, bubble: null },
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
    sp.position.set(0, 2.4, 0);
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
  function pathTo(ch, dest) {
    const pts = [];
    const P = (x, y, z, room, ride) => pts.push({ x, y, z, room, ride });
    const cur = ch.room === "exit" ? null : rooms[ch.room];
    const tgt = dest.roomId === "exit" ? null : rooms[dest.roomId];
    const liftX = SHAFT_W / 2 + rnd(-0.3, 0.3);
    const fromY = cur ? cur.y0 : 0, toY = tgt ? tgt.y0 : 0;
    const A = B.aisleZ;

    if (cur && tgt && cur.id === tgt.id) {
      P(ch.pos.x, fromY, A, cur.id); P(dest.x, fromY, A, cur.id); P(dest.x, fromY, dest.z, cur.id);
    } else {
      if (cur) { P(ch.pos.x, fromY, A, cur.id); }
      else { P(ch.pos.x, 0, B.frontZ + 1.2, "lobby"); P(B.w / 2, 0, B.frontZ - 0.4, "lobby"); P(B.w / 2, 0, A, "lobby"); }
      if (fromY !== toY) {
        P(B.lobbyX, fromY, A, cur ? cur.id : "lobby");
        P(liftX, fromY, A, cur ? cur.id : "lobby");
        P(liftX, fromY, 0.2, cur ? cur.id : "lobby");
        P(liftX, toY, 0.2, tgt ? tgt.id : "lobby", true);
        P(liftX, toY, A, tgt ? tgt.id : "lobby");
        P(B.lobbyX, toY, A, tgt ? tgt.id : "lobby");
      }
      if (tgt) { P(dest.x, toY, A, tgt.id); P(dest.x, toY, dest.z, tgt.id); }
      else { P(B.w / 2, 0, A, "lobby"); P(B.w / 2, 0, B.frontZ + 1.2, "lobby"); P(dest.x, 0, dest.z, "exit"); }
    }
    return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y, p.z - pts[i - 1].z) > 0.05);
  }
  function arrive(ch) {
    ch.arrived = true;
    const d = ch.dest;
    if (!d) return;
    ch.targetRot = d.face;
    if (d.seat) ch.seated = true;
    if (d.desk) d.desk.screen.material.emissiveIntensity = 1.0;
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
        ch.walkT += dt * 8.5;
        const s = Math.sin(ch.walkT);
        P.legL.rotation.x = s * 0.7; P.legR.rotation.x = -s * 0.7;
        P.armL.rotation.x = -s * 0.5; P.armR.rotation.x = s * 0.5;
        P.head.rotation.y = 0;
        bob = Math.abs(Math.cos(ch.walkT)) * 0.05;
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
    cam.theta = Math.max(-1.35, Math.min(1.35, cam.theta));
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
      const rx = Math.cos(cam.theta), rz = -Math.sin(cam.theta);
      cam.target.x -= rx * dx * k;
      cam.target.z -= rz * dx * k;
      cam.target.y += dy * k;
      cam.target.x = Math.max(-6, Math.min(B.w + 6, cam.target.x));
      cam.target.y = Math.max(0, Math.min(B.h + 4, cam.target.y));
      cam.target.z = Math.max(-6, Math.min(14, cam.target.z));
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
