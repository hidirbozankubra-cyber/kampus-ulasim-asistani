(function () {
"use strict";
// Saf (DOM'suz) fonksiyonlar: sefer hesabı, saatlik dağılım, KPI, grafik özeti.
// Zamanlar "gece yarısından beri dakika"dır; 1440 üstü değerler ertesi gün sabahını (gece seferi) gösterir.
// dow: 0=Pazar ... 6=Cumartesi (JS Date.getDay ile aynı).

const DAY_LABEL = { WD: "hafta içi", SA: "Cumartesi", SU: "Pazar" };

function dayType(dow) {
  return dow === 0 ? "SU" : dow === 6 ? "SA" : "WD";
}

function fmt(min) {
  const m = ((min % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

/** Takvim gününün 00:00–24:00 aralığındaki seferler: bugünün <1440 olanları + dünün gece seferleri. */
function dayEntries(sched, dow) {
  const today = (sched[dayType(dow)] || []).filter((d) => d[0] < 1440);
  const prev = (sched[dayType((dow + 6) % 7)] || []).filter((d) => d[0] >= 1440).map((d) => [d[0] - 1440, d[1], d[2]]);
  return prev.concat(today).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function keep(list, routeIdx) {
  return routeIdx === null || routeIdx === undefined || routeIdx === "" ? list : list.filter((d) => d[1] === routeIdx);
}

/** Şimdiden sonraki n sefer; bugün yetmezse ertesi günün ilk seferleriyle tamamlanır. */
function nextDepartures(sched, dow, nowMin, n = 3, routeIdx = null) {
  const out = [];
  for (const d of keep(dayEntries(sched, dow), routeIdx)) {
    if (d[0] >= nowMin) out.push({ at: d[0], route: d[1], head: d[2], tomorrow: false });
  }
  if (out.length < n) {
    for (const d of keep(dayEntries(sched, (dow + 1) % 7), routeIdx)) {
      out.push({ at: d[0] + 1440, route: d[1], head: d[2], tomorrow: true });
      if (out.length >= n) break;
    }
  }
  return out.slice(0, n).map((x) => ({ ...x, wait: x.at - nowMin }));
}

function hourlyCounts(sched, dow, routeIdx = null) {
  const c = new Array(24).fill(0);
  for (const d of keep(dayEntries(sched, dow), routeIdx)) c[Math.floor(d[0] / 60) % 24]++;
  return c;
}

function routeTotals(sched, dow) {
  const m = new Map();
  for (const d of dayEntries(sched, dow)) m.set(d[1], (m.get(d[1]) || 0) + 1);
  return [...m.entries()].map(([route, count]) => ({ route, count })).sort((a, b) => b.count - a.count);
}

/** 06:00–23:00 arası ortalama sefer aralığı (dk); yetersiz veri varsa null. */
function avgHeadway(sched, dow, routeIdx = null) {
  const t = keep(dayEntries(sched, dow), routeIdx).map((d) => d[0]).filter((m) => m >= 360 && m <= 1380);
  if (t.length < 2) return null;
  return Math.round((t[t.length - 1] - t[0]) / (t.length - 1));
}

function waitText(wait) {
  if (wait <= 0) return "şimdi kalkıyor";
  if (wait < 60) return wait + " dakika sonra";
  const h = Math.floor(wait / 60), m = wait % 60;
  return h + " saat" + (m ? " " + m + " dakika" : "") + " sonra";
}

/** Grafik için tek cümlelik otomatik özet. */
function hourlySummary(counts, label) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return "Seçili koşullarda planlı sefer yok.";
  let peak = 0;
  counts.forEach((v, i) => { if (v > counts[peak]) peak = i; });
  const first = counts.findIndex((v) => v > 0);
  const last = counts.length - 1 - [...counts].reverse().findIndex((v) => v > 0);
  return `${label}: gün boyunca toplam ${total} sefer var; en yoğun saat ${fmt(peak * 60)}–${fmt(peak * 60 + 60)} aralığı (${counts[peak]} sefer), seferler ${fmt(first * 60)} ile ${fmt(last * 60 + 59)} arasında.`;
}

/** Europe/Istanbul'a göre şu an: { dow, min }. */
function istanbulNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  const dow = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get("weekday")];
  return { dow, min: Number(get("hour")) * 60 + Number(get("minute")) };
}

function normalizeTr(s) {
  return s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
}

// Klasik betik olarak yüklenir (file:// üzerinde de çalışsın diye ES modülü kullanılmaz).
globalThis.KUA = { DAY_LABEL, dayType, fmt, dayEntries, nextDepartures, hourlyCounts, routeTotals, avgHeadway, waitText, hourlySummary, istanbulNow, normalizeTr };

})();
