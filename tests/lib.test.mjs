import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
// lib.js klasik betiktir (window.KUA); ana bağlamda çalıştırıp globalThis.KUA'yı okuyoruz.
vm.runInThisContext(fs.readFileSync(new URL("../public/js/lib.js", import.meta.url), "utf8"));
const ctx = { KUA: globalThis.KUA };
const { dayType, dayEntries, nextDepartures, hourlyCounts, avgHeadway, waitText, hourlySummary, fmt, istanbulNow, normalizeTr } = ctx.KUA;

// [dk, hatIndeksi, yönIndeksi]
const sched = {
  WD: [[300, 0, 0], [480, 0, 0], [490, 1, 1], [1400, 0, 0], [1450, 1, 1]], // 1450 = ertesi gün 00:10
  SA: [[600, 0, 0]],
  SU: [],
};

test("gün türü", () => {
  assert.equal(dayType(0), "SU");
  assert.equal(dayType(6), "SA");
  assert.equal(dayType(3), "WD");
});

test("dayEntries: dünün gece seferi bugünün başına eklenir", () => {
  // Cumartesi (6) için dün Cuma: 1450 -> 00:10
  const e = dayEntries(sched, 6);
  assert.deepEqual(e[0], [10, 1, 1]);
  assert.equal(e.length, 2); // 00:10 + SA 10:00
});

test("sonraki 3 sefer sıralı ve doğru", () => {
  const n = nextDepartures(sched, 3, 470, 3);
  assert.deepEqual(n.map((x) => x.at), [480, 490, 1400]);
  assert.equal(n[0].wait, 10);
});

test("hat filtresi", () => {
  const n = nextDepartures(sched, 3, 470, 3, 1);
  assert.ok(n.every((x) => x.route === 1));
});

test("gün sonunda ertesi güne taşar", () => {
  const n = nextDepartures(sched, 5, 1000, 3); // Cuma 16:40 -> Cuma 23:20, sonra Cumartesi
  assert.equal(n[0].at, 1400);
  assert.equal(n[1].tomorrow, true);
  assert.equal(n.length, 3);
});

test("boş tarife -> boş sonuç, hata yok", () => {
  assert.deepEqual(nextDepartures({}, 3, 0, 3), []);
  assert.deepEqual(hourlyCounts({}, 3), new Array(24).fill(0));
  assert.equal(avgHeadway({}, 3), null);
  assert.match(hourlySummary(new Array(24).fill(0), "x"), /sefer yok/);
});

test("saatlik dağılım ve özet", () => {
  const c = hourlyCounts(sched, 3);
  assert.equal(c[5], 1);
  assert.equal(c[8], 2);
  assert.equal(c[0], 1); // Salı gecesinin 00:10 seferi Çarşamba'ya düşer
  assert.equal(c.reduce((a, b) => a + b), 5); // 300, 480, 490, 1400 + dünden taşan 00:10
  assert.match(hourlySummary(c, "Bu durak"), /en yoğun saat 08:00–09:00/);
});

test("biçim ve bekleme metni", () => {
  assert.equal(fmt(1450), "00:10");
  assert.equal(waitText(0), "şimdi kalkıyor");
  assert.equal(waitText(5), "5 dakika sonra");
  assert.equal(waitText(65), "1 saat 5 dakika sonra");
});

test("İstanbul saati: sabit anda doğru gün/dakika", () => {
  // 2026-10-25 22:21 +03:00 Pazar
  const r = istanbulNow(new Date("2026-10-25T19:21:00Z"));
  assert.deepEqual(r, { dow: 0, min: 22 * 60 + 21 });
  // UTC'de Cumartesi 22:30 ama İstanbul'da Pazar 01:30
  assert.deepEqual(istanbulNow(new Date("2026-10-24T22:30:00Z")), { dow: 0, min: 90 });
});

test("Türkçe arama normalizasyonu", () => {
  assert.equal(normalizeTr("ÜNİVERSİTE Çarşı"), normalizeTr("universite carsi"));
});
