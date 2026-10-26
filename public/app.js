const {
  DAY_LABEL, dayType, dayEntries, nextDepartures, hourlyCounts, routeTotals, avgHeadway,
  waitText, hourlySummary, fmt, istanbulNow, normalizeTr,
} = globalThis.KUA;

window.__appStarted = true;
const $ = (id) => document.getElementById(id);
const BASE = (new URLSearchParams(location.search).get("dataBase") || "data/").replace(/([^/])$/, "$1/");
const DAY_DOW = { weekday: 3, saturday: 6, sunday: 0 };
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = {
  data: null, fromCache: false,
  campus: "", stopId: "", route: "all", day: "today", time: "", search: "",
  sortKey: "time", sortDir: 1,
};
let freqChart = null, routesChart = null, map = null, markerLayer = null, markers = new Map();

/* ---------- yükleme ---------- */
async function getJSON(name) {
  const r = await fetch(BASE + name, { cache: "no-cache" });
  if (!r.ok) throw new Error(name + " → HTTP " + r.status);
  return { json: await r.json(), cached: r.headers.get("X-From-Cache") === "1" };
}

async function load() {
  setLoading(true);
  hide($("messageBox"));
  try {
    let meta, stops, routes, dep;
    try {
      [meta, stops, routes, dep] = await Promise.all(["meta.json", "stops.json", "routes.json", "departures.json"].map(getJSON));
    } catch (err) {
      // fetch çalışmıyorsa (ör. dosya çift tıklanarak file:// ile açıldı) gömülü pakete düş
      const d = window.KUA_DATA;
      if (!d) throw err;
      const wrap = (json) => ({ json, cached: location.protocol !== "file:" });
      [meta, stops, routes, dep] = [wrap(d.meta), wrap({ campuses: d.campuses, stops: d.stops }), wrap(d.routes), wrap(d.dep)];
    }
    state.data = { meta: meta.json, campuses: stops.json.campuses, stops: stops.json.stops, routes: routes.json, dep: dep.json };
    state.fromCache = [meta, stops, routes, dep].some((x) => x.cached);
    init();
  } catch (e) {
    console.error(e);
    setLoading(false);
    setStatus("err", "Veri alınamadı");
    $("lastUpdated").textContent = "Veri alınamadı";
    $("nextDepartures").replaceChildren();
    const box = $("messageBox");
    box.className = "message err";
    box.hidden = false;
    box.replaceChildren(
      el("p", { text: "Sefer verisi şu anda alınamadı ve daha önce kaydedilmiş bir kopya da yok. İnternet bağlantınızı kontrol edip yeniden deneyin." }),
    );
    const b = el("button", { cls: "button", text: "Yeniden dene" });
    b.type = "button";
    b.addEventListener("click", load);
    box.append(b);
    box.focus?.();
  }
}

function setLoading(on) {
  $("nextDepartures").setAttribute("aria-busy", String(on));
  if (on) {
    $("nextDepartures").replaceChildren(el("div", { cls: "skeleton" }), el("div", { cls: "skeleton" }), el("div", { cls: "skeleton" }));
    setStatus("", "Veri kontrol ediliyor…");
  }
}

function setStatus(kind, text) {
  $("statusDot").className = "status-dot " + kind;
  $("dataStatus").textContent = text;
}

function showBanner(kind, text) {
  const b = $("banner");
  b.className = "banner " + kind;
  b.textContent = text;
  b.hidden = false;
}

/* ---------- yardımcılar ---------- */
function el(tag, { cls, text, attrs } = {}) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  return n;
}
const hide = (n) => { n.hidden = true; };
const routeLabel = (idx) => {
  const id = state.data.dep.routes[idx];
  return (state.data.routes[id] && state.data.routes[id].short) || id;
};
const headLabel = (idx) => state.data.dep.headsigns[idx] || "Yön bilgisi yok";
const stopById = (id) => state.data.stops.find((s) => s.id === id);
const campusStops = () => state.data.stops.filter((s) => s.campus[0] === state.campus || s.campus.includes(state.campus)).sort((a, b) => a.dist - b.dist);
const schedOf = () => (state.data.dep.stops[state.stopId] || {});
const routeIdx = () => (state.route === "all" ? null : Number(state.route));

function when() {
  const now = istanbulNow();
  const dow = state.day === "today" ? now.dow : DAY_DOW[state.day];
  let min = now.min;
  if (state.time) { const [h, m] = state.time.split(":").map(Number); min = h * 60 + m; }
  return { dow, min, isLive: !state.time && state.day === "today" };
}

function fmtStamp(iso) {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short" });
}

/* ---------- başlangıç ---------- */
function init() {
  const { meta, campuses, stops } = state.data;
  setLoading(false);
  const ageDays = (Date.now() - new Date(meta.generated_at)) / 864e5;
  $("lastUpdated").textContent = fmtStamp(meta.generated_at);
  if (meta.sample) {
    showBanner("sample", "Bu ekranda ÖRNEK (uydurma) veri var; gerçek ESHOT tarifesi değildir.");
    setStatus("warn", "Örnek veri");
  } else if (state.fromCache) {
    showBanner("warn", `Bağlantı kurulamadı; son başarılı veri gösteriliyor (güncelleme: ${fmtStamp(meta.generated_at)}).`);
    setStatus("warn", "Çevrimdışı: son veri");
  } else if (ageDays > 3) {
    showBanner("warn", `Veri ${Math.floor(ageDays)} gündür güncellenmedi; saatler değişmiş olabilir.`);
    setStatus("warn", "Veri eski olabilir");
  } else {
    hide($("banner"));
    setStatus("ok", "Gerçek ESHOT tarifesi");
  }
  const withStops = campuses.filter((c) => stops.some((s) => s.campus.includes(c.id)));
  const cs = $("campusSelect");
  cs.replaceChildren(...withStops.map((c) => Object.assign(el("option", { text: c.name }), { value: c.id })));
  if (!state.campus || !withStops.some((c) => c.id === state.campus)) state.campus = withStops[0].id;
  cs.value = state.campus;
  state.stopId = "";
  refreshStopSelect();
  renderAll(false);
}

function refreshStopSelect() {
  const q = normalizeTr(state.search);
  const list = campusStops().filter((s) => !q || normalizeTr(s.name).includes(q));
  const sel = $("stopSelect");
  const box = $("messageBox");
  if (!list.length) {
    sel.replaceChildren(Object.assign(el("option", { text: "Eşleşen durak yok" }), { value: "" }));
    sel.disabled = true;
    state.stopId = "";
    box.className = "message";
    box.hidden = false;
    box.textContent = `“${state.search}” aramasına uyan durak bulunamadı. Aramayı değiştirin veya “Filtreleri sıfırla” düğmesini kullanın.`;
    return;
  }
  sel.disabled = false;
  if (box.className === "message" && !box.hidden) hide(box);
  sel.replaceChildren(...list.map((s) => Object.assign(el("option", { text: `${s.name} (${s.dist} m)` }), { value: s.id })));
  if (!list.some((s) => s.id === state.stopId)) state.stopId = list[0].id;
  sel.value = state.stopId;
  refreshRouteSelect();
}

function refreshRouteSelect() {
  const sched = schedOf();
  const idxs = new Set();
  for (const k of ["WD", "SA", "SU"]) (sched[k] || []).forEach((d) => idxs.add(d[1]));
  const opts = [Object.assign(el("option", { text: "Tüm hatlar" }), { value: "all" })];
  [...idxs].sort((a, b) => routeLabel(a).localeCompare(routeLabel(b), "tr", { numeric: true }))
    .forEach((i) => opts.push(Object.assign(el("option", { text: "Hat " + routeLabel(i) }), { value: String(i) })));
  $("routeSelect").replaceChildren(...opts);
  if (state.route !== "all" && !idxs.has(Number(state.route))) state.route = "all";
  $("routeSelect").value = state.route;
  $("kpiRoutes").textContent = String(idxs.size);
}

/* ---------- çizim ---------- */
function renderAll(announce) {
  if (!state.data) return;
  $("kpiStops").textContent = String(campusStops().length);
  renderStopsTable();
  renderMap();
  if (!state.stopId) {
    $("nextDepartures").replaceChildren();
    $("selectedStopText").textContent = "Bir durak seçin.";
    $("kpiNext").textContent = "—";
    $("departuresTable").tBodies[0].replaceChildren();
    return;
  }
  renderNext(announce);
  renderCharts();
  renderDetail();
}

function renderNext(announce) {
  const s = stopById(state.stopId);
  const w = when();
  const dt = dayType(w.dow);
  const list = nextDepartures(schedOf(), w.dow, w.min, 3, routeIdx());
  $("selectedStopText").textContent = `${s.name} · ${DAY_LABEL[dt]} tarifesi · saat ${fmt(w.min)}${w.isLive ? " (şimdi)" : ""}`;
  const wrap = $("nextDepartures");
  wrap.setAttribute("aria-busy", "false");
  if (!list.length) {
    wrap.replaceChildren(el("p", { cls: "message", text: "Seçtiğiniz koşullarda bu durak için planlı sefer bulunamadı. Hat filtresini veya gün türünü değiştirmeyi deneyin." }));
    $("kpiNext").textContent = "—";
    if (announce) $("liveText").textContent = "Seçtiğiniz koşullarda planlı sefer bulunamadı.";
    return;
  }
  const items = list.map((d, i) => {
    const card = el("article", { cls: "departure" });
    card.append(el("span", { cls: "rank", text: `${i + 1}. sefer` }));
    card.append(el("span", { cls: "time", text: fmt(d.at) + (d.tomorrow ? " (yarın)" : "") }));
    const meta = el("span", { cls: "meta" });
    const line = el("span");
    line.append(el("span", { cls: "route-badge", text: routeLabel(d.route) }), document.createTextNode("Yön: " + headLabel(d.head)));
    meta.append(line, el("span", { cls: "wait", text: waitText(d.wait) }));
    card.append(meta);
    return card;
  });
  wrap.replaceChildren(...items);
  $("kpiNext").textContent = fmt(list[0].at);
  if (announce) {
    $("liveText").textContent = `${s.name} durağı. Sonraki seferler: ` + list.map((d) =>
      `${routeLabel(d.route)} hattı, saat ${fmt(d.at)}${d.tomorrow ? " yarın" : ""}, ${waitText(d.wait)}`).join("; ") + ".";
  }
}

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function renderCharts() {
  const sched = schedOf();
  const w = when();
  const dt = DAY_LABEL[dayType(w.dow)];
  // Ana grafik: saatlik sefer sıklığı
  const counts = hourlyCounts(sched, w.dow, routeIdx());
  const labels = counts.map((_, h) => fmt(h * 60));
  $("frequencySummary").textContent = hourlySummary(counts, `${stopById(state.stopId).name}, ${dt} tarifesi${state.route === "all" ? "" : ", hat " + routeLabel(Number(state.route))}`);
  $("frequencyChart").setAttribute("aria-label", $("frequencySummary").textContent);
  $("chartDataTable").tBodies[0].replaceChildren(...counts.map((c, h) => {
    const tr = el("tr"); tr.append(el("td", { text: labels[h] }), Object.assign(el("td", { text: String(c) }), { className: "num" })); return tr;
  }));
  // İkincil grafik: hat başına günlük sefer
  const totals = routeTotals(sched, w.dow).slice(0, 8);
  $("routesSummary").textContent = totals.length
    ? `${dt} tarifesinde bu durakta en çok sefer yapan hat ${routeLabel(totals[0].route)} (${totals[0].count} sefer); toplam ${totals.length}${totals.length === 8 ? "+" : ""} hat listeleniyor.`
    : "Seçili koşullarda planlı sefer yok.";
  $("routesChart").setAttribute("aria-label", $("routesSummary").textContent);
  $("routesDataTable").tBodies[0].replaceChildren(...totals.map((t) => {
    const tr = el("tr"); tr.append(el("td", { text: "Hat " + routeLabel(t.route) }), Object.assign(el("td", { text: String(t.count) }), { className: "num" })); return tr;
  }));

  if (typeof Chart === "undefined") {
    document.querySelectorAll(".chart-wrap").forEach((n) => { n.hidden = true; });
    document.querySelectorAll(".panel details").forEach((d) => { d.open = true; });
    return;
  }
  const muted = css("--muted"), line = css("--line"), accent = css("--accent");
  const common = { responsive: true, maintainAspectRatio: false, animation: reduceMotion ? false : undefined,
    plugins: { legend: { display: false } } };
  const axis = { ticks: { color: muted }, grid: { color: line } };
  if (!freqChart) {
    freqChart = new Chart($("frequencyChart"), {
      type: "bar",
      data: { labels, datasets: [{ label: "Sefer sayısı", data: counts, backgroundColor: accent, borderColor: accent, borderWidth: 1 }] },
      options: { ...common, scales: { x: { ...axis, title: { display: true, text: "Saat", color: muted } }, y: { ...axis, beginAtZero: true, ticks: { color: muted, precision: 0 }, title: { display: true, text: "Sefer sayısı", color: muted } } } },
    });
  } else { freqChart.data.datasets[0].data = counts; freqChart.update(); }
  if (!routesChart) {
    routesChart = new Chart($("routesChart"), {
      type: "bar",
      data: { labels: totals.map((t) => "Hat " + routeLabel(t.route)), datasets: [{ label: "Sefer sayısı", data: totals.map((t) => t.count), backgroundColor: accent }] },
      options: { ...common, indexAxis: "y", scales: { x: { ...axis, beginAtZero: true, ticks: { color: muted, precision: 0 } }, y: axis } },
    });
  } else {
    routesChart.data.labels = totals.map((t) => "Hat " + routeLabel(t.route));
    routesChart.data.datasets[0].data = totals.map((t) => t.count);
    routesChart.update();
  }
}

function renderStopsTable() {
  const body = $("stopsTable").tBodies[0];
  const q = normalizeTr(state.search);
  const rows = campusStops().filter((s) => !q || normalizeTr(s.name).includes(q)).map((s) => {
    const tr = el("tr");
    const sel = s.id === state.stopId;
    if (sel) { tr.className = "is-selected"; tr.setAttribute("aria-current", "true"); }
    tr.append(el("td", { text: s.name + (sel ? " (seçili)" : "") }), el("td", { text: s.dist + " m", cls: "num" }),
      el("td", { text: s.lat.toFixed(5), cls: "num" }), el("td", { text: s.lon.toFixed(5), cls: "num" }));
    const td = el("td");
    const b = el("button", { cls: "row-button", text: "Seç", attrs: { type: "button", "aria-label": `${s.name} durağını seç` } });
    b.addEventListener("click", () => selectStop(s.id, true));
    td.append(b); tr.append(td);
    return tr;
  });
  body.replaceChildren(...rows);
}

const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, text) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

// Kütüphanesiz harita: Web Mercator ile durakları SVG'ye çizer; internet varsa OpenStreetMap karoları altlık olur.
function renderMap() {
  const box = $("stopMap");
  const list = campusStops();
  box.replaceChildren();
  if (!list.length) { box.textContent = "Bu kampüs için gösterilecek durak yok."; box.style.padding = "16px"; return; }
  box.style.padding = "";
  const W = 800, H = 450;
  const proj = (lat, lon, z) => {
    const n = 256 * 2 ** z, r = (lat * Math.PI) / 180;
    return [((lon + 180) / 360) * n, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n];
  };
  const lats = list.map((x) => x.lat), lons = list.map((x) => x.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
  let z = 17;
  for (; z > 10; z--) {
    const p1 = proj(maxLat, minLon, z), p2 = proj(minLat, maxLon, z);
    if (p2[0] - p1[0] <= W - 200 && p2[1] - p1[1] <= H - 140) break;
  }
  const p1 = proj(maxLat, minLon, z), p2 = proj(minLat, maxLon, z);
  const ox = (p1[0] + p2[0]) / 2 - W / 2, oy = (p1[1] + p2[1]) / 2 - H / 2;

  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", class: "map-svg",
    "aria-label": "Durak haritası. Aynı duraklar aşağıdaki listede de var." });
  svg.append(svgEl("rect", { width: W, height: H, class: "map-bg" }));

  const tiles = svgEl("g", { class: "map-tiles", "aria-hidden": "true" });
  const max = 2 ** z;
  for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++) {
    for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++) {
      if (ty < 0 || ty >= max) continue;
      const img = svgEl("image", { href: `https://tile.openstreetmap.org/${z}/${((tx % max) + max) % max}/${ty}.png`,
        x: tx * 256 - ox, y: ty * 256 - oy, width: 256, height: 256 });
      img.addEventListener("error", () => img.remove());
      tiles.append(img);
    }
  }
  svg.append(tiles);

  const pts = list.map((st) => { const [px, py] = proj(st.lat, st.lon, z); return { st, x: px - ox, y: py - oy }; });
  // Seçili durak en üstte çizilsin
  pts.sort((a, b) => (a.st.id === state.stopId) - (b.st.id === state.stopId));
  for (const { st, x, y } of pts) {
    const sel = st.id === state.stopId;
    const g = svgEl("g", { tabindex: "0", role: "button", "data-id": st.id, class: "map-stop" + (sel ? " sel" : ""),
      "aria-pressed": String(sel), "aria-label": `${st.name}, ${st.dist} metre${sel ? ", seçili" : ""}` });
    g.append(svgEl("title", {}, st.name));
    g.append(svgEl("circle", { cx: x, cy: y, r: sel ? 14 : 9, class: "mk" }));
    if (sel) {
      g.append(svgEl("circle", { cx: x, cy: y, r: 4.5, class: "mk-in" }));
      const right = x < W - 260;
      g.append(svgEl("text", { x: right ? x + 20 : x - 20, y: y + 5, "text-anchor": right ? "start" : "end", class: "map-label" }, st.name));
    }
    const pick = () => { state.mapFocus = st.id; selectStop(st.id, true); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    svg.append(g);
  }
  svg.append(svgEl("text", { x: W - 8, y: H - 8, "text-anchor": "end", class: "map-attr" }, "© OpenStreetMap katkıda bulunanlar"));
  box.append(svg);
  if (state.mapFocus) {
    const f = [...svg.querySelectorAll(".map-stop")].find((n) => n.dataset.id === state.mapFocus);
    state.mapFocus = null;
    if (f) f.focus();
  }
}

function renderDetail() {
  const w = when();
  const stop = stopById(state.stopId);
  let rows = dayEntries(schedOf(), w.dow);
  if (routeIdx() !== null) rows = rows.filter((d) => d[1] === routeIdx());
  const key = state.sortKey, dir = state.sortDir;
  rows = rows.slice().sort((a, b) => {
    if (key === "time") return (a[0] - b[0]) * dir;
    const va = key === "route" ? routeLabel(a[1]) : headLabel(a[2]);
    const vb = key === "route" ? routeLabel(b[1]) : headLabel(b[2]);
    return va.localeCompare(vb, "tr", { numeric: true }) * dir || a[0] - b[0];
  });
  document.querySelectorAll("#departuresTable thead th").forEach((th) => {
    const b = th.querySelector(".sort-button");
    if (b) th.setAttribute("aria-sort", b.dataset.sort === key ? (dir === 1 ? "ascending" : "descending") : "none");
  });
  const body = $("departuresTable").tBodies[0];
  if (!rows.length) {
    const tr = el("tr"); const td = el("td", { text: "Seçili koşullarda sefer yok." }); td.colSpan = 4; tr.append(td);
    body.replaceChildren(tr);
    return;
  }
  body.replaceChildren(...rows.map((d) => {
    const tr = el("tr");
    tr.append(el("td", { text: fmt(d[0]), cls: "num" }), el("td", { text: routeLabel(d[1]) }), el("td", { text: headLabel(d[2]) }), el("td", { text: stop.name }));
    return tr;
  }));
}

/* ---------- etkileşim ---------- */
function selectStop(id, announce) {
  state.stopId = id;
  $("stopSelect").value = id;
  refreshRouteSelect();
  renderAll(announce);
}

$("campusSelect").addEventListener("change", (e) => { state.campus = e.target.value; state.stopId = ""; state.search = ""; $("stopSearch").value = ""; state.route = "all"; refreshStopSelect(); renderAll(true); });
$("stopSearch").addEventListener("input", (e) => { state.search = e.target.value; refreshStopSelect(); renderAll(false); });
$("stopSelect").addEventListener("change", (e) => selectStop(e.target.value, true));
$("routeSelect").addEventListener("change", (e) => { state.route = e.target.value; renderAll(true); });
$("daySelect").addEventListener("change", (e) => { state.day = e.target.value; renderAll(true); });
$("timeInput").addEventListener("change", (e) => { state.time = e.target.value; renderAll(true); });
$("resetBtn").addEventListener("click", () => {
  Object.assign(state, { route: "all", day: "today", time: "", search: "", stopId: "", sortKey: "time", sortDir: 1 });
  $("daySelect").value = "today"; $("timeInput").value = ""; $("stopSearch").value = "";
  if (state.data) { refreshStopSelect(); renderAll(true); }
});
document.querySelectorAll(".sort-button").forEach((b) => b.addEventListener("click", () => {
  const k = b.dataset.sort;
  if (state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = 1; }
  renderDetail();
}));

// "Şimdi" modunda ekranı her 30 sn tazele (ekran okuyucuyu rahatsız etmemek için duyuru yapılmaz).
setInterval(() => {
  if (state.data && state.stopId && when().isLive) renderNext(false);
}, 30000);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
window.addEventListener("load", load);
if (document.readyState === "complete") load();
