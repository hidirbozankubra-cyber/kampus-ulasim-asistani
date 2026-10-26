#!/usr/bin/env python3
"""GTFS -> kampüs durakları için küçük JSON dosyaları.

Kullanım:
  python scripts/fetch_gtfs.py                    # CKAN API'den ESHOT GTFS'i bulup indirir
  GTFS_URL=https://.../gtfs.zip python scripts/fetch_gtfs.py
  python scripts/fetch_gtfs.py --gtfs-dir ./ornek_gtfs [--sample]   # yerel klasör (test)

Yalnızca standart kütüphane kullanır. API anahtarı gerekmez (açık veri); anahtar
gerekirse ortam değişkeni olarak okunur, istemci koduna asla yazılmaz.
Hata olursa sıfır olmayan kodla çıkar ve public/data içindeki son başarılı dosyalara dokunmaz.
"""
import argparse, csv, io, json, math, os, sys, tempfile, time, urllib.request, zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(os.environ.get("OUT_DIR", ROOT / "public" / "data"))
CKAN_PACKAGE = os.environ.get(
    "CKAN_PACKAGE_URL",
    "https://acikveri.bizizmir.com/api/3/action/package_show?id=toplu-ulasim-gtfs-verileri",
)
SOURCE_PAGE = "https://acikveri.bizizmir.com/tr/dataset/toplu-ulasim-gtfs-verileri"
# Veri seti sayfasındaki "Otobüs GTFS verileri" kaynağı (ESHOT, ~19 MB). GTFS_URL ile değiştirilebilir.
DEFAULT_GTFS_URL = "https://www.eshot.gov.tr/gtfs/bus-eshot-gtfs.zip"
# Zip güvenliği: aşırı büyük indirme / açılmış boyut (zip bomb) reddedilir.
MAX_DOWNLOAD = int(os.environ.get("KUA_MAX_DOWNLOAD_MB", "300")) * 1024 * 1024
MAX_UNZIPPED = int(os.environ.get("KUA_MAX_UNZIPPED_MB", "2048")) * 1024 * 1024
RESOURCE_MATCH = os.environ.get("GTFS_RESOURCE_MATCH", "eshot").lower()
TZ = timezone(timedelta(hours=3))  # Europe/Istanbul
REQUIRED = ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"]
OPTIONAL = ["calendar.txt", "calendar_dates.txt", "feed_info.txt"]
# Gün türü -> temsilci gün (Python weekday: Pzt=0 ... Paz=6)
DAYTYPES = {"WD": 2, "SA": 5, "SU": 6}
WEEKDAY_COLS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def log(*a):
    print(*a, file=sys.stderr)


def http_get(url, tries=3, timeout=120):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "kampus-ulasim-asistani/1.0 (ogrenci projesi)"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read(MAX_DOWNLOAD + 1)
                if len(data) > MAX_DOWNLOAD:
                    raise RuntimeError(f"İndirme {MAX_DOWNLOAD // 2**20} MB sınırını aştı")
                return data
        except Exception as e:  # noqa: BLE001
            last = e
            log(f"  istek başarısız ({i + 1}/{tries}): {e}")
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"İndirilemedi: {url}: {last}")


def download_gtfs(dest: Path):
    """GTFS dosyalarını dest klasörüne koyar. Dönen: (kaynak_url, lisans)."""
    forced = os.environ.get("GTFS_URL")
    direct = forced or DEFAULT_GTFS_URL
    license_name = "İzmir Büyükşehir Belediyesi Açık Veri Lisansı (CC BY 4.0)"
    log("GTFS adresi:", direct)
    try:
        extract_zip(http_get(direct), dest)
        return direct, license_name
    except Exception as e:  # noqa: BLE001
        if forced:
            raise
        log("Varsayılan adres başarısız, CKAN'dan aranıyor:", e)
    log("CKAN paket bilgisi okunuyor:", CKAN_PACKAGE)
    pkg = json.loads(http_get(CKAN_PACKAGE))
    if not pkg.get("success"):
        raise RuntimeError("CKAN yanıtı başarısız")
    result = pkg["result"]
    license_name = result.get("license_title") or license_name
    res = result.get("resources", [])
    zips = [r for r in res if (r.get("url", "").lower().endswith(".zip") or (r.get("format") or "").upper() in ("ZIP", "GTFS"))]
    if zips:
        pick = [r for r in zips if RESOURCE_MATCH in (r.get("name", "") + r.get("url", "")).lower()]
        if not pick:
            log(f"UYARI: adında '{RESOURCE_MATCH}' geçen zip yok; ilk zip kullanılıyor.")
            pick = zips[:1]
        r = pick[0]
        log("Kaynak:", r.get("name"), r.get("url"))
        extract_zip(http_get(r["url"]), dest)
        return r["url"], license_name
    # Ayrı .txt kaynakları
    found = 0
    for r in res:
        name = Path(r.get("url", "")).name.lower()
        if name in REQUIRED + OPTIONAL:
            (dest / name).write_bytes(http_get(r["url"]))
            found += 1
    if found:
        return SOURCE_PAGE, license_name
    raise RuntimeError("CKAN paketinde GTFS zip veya .txt kaynağı bulunamadı; GTFS_URL ortam değişkenini ayarlayın.")


def extract_zip(data: bytes, dest: Path):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        wanted = [i for i in z.infolist() if Path(i.filename).name.lower() in REQUIRED + OPTIONAL and not i.is_dir()]
        total = sum(i.file_size for i in wanted)
        if total > MAX_UNZIPPED:
            raise RuntimeError(f"Zip açıldığında {total // 2**20} MB olur; sınır {MAX_UNZIPPED // 2**20} MB (zip bomb koruması)")
        for i in wanted:
            # Yalnızca beklenen dosya adları, yalnızca dest içine (Zip Slip'e karşı yol bileşenleri atılır)
            (dest / Path(i.filename).name.lower()).write_bytes(z.read(i))


def rows(path: Path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            yield {(k or "").strip(): (v or "").strip() for k, v in row.items()}


def hhmm(t: str):
    try:
        h, m, _ = (t.split(":") + ["0"])[:3]
        return int(h) * 60 + int(m)
    except ValueError:
        return None


def haversine(lat1, lon1, lat2, lon2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def service_days(gtfs: Path):
    """service_id -> {haftanın günü (0=Pzt)} kümesi."""
    days = {}
    cal = gtfs / "calendar.txt"
    if cal.exists():
        for r in rows(cal):
            days[r["service_id"]] = {i for i, c in enumerate(WEEKDAY_COLS) if r.get(c) == "1"}
    cd = gtfs / "calendar_dates.txt"
    if cd.exists():
        added = {}
        for r in rows(cd):
            if r.get("exception_type") == "1" and len(r.get("date", "")) == 8:
                d = datetime.strptime(r["date"], "%Y%m%d").weekday()
                added.setdefault(r["service_id"], set()).add(d)
        for sid, s in added.items():
            days.setdefault(sid, set()).update(s)
    return days


def build(gtfs: Path, sample: bool, source_url: str, license_name: str):
    for f in REQUIRED:
        if not (gtfs / f).exists():
            raise RuntimeError(f"GTFS içinde {f} yok")
    cfg = json.loads((ROOT / "config" / "campuses.json").read_text(encoding="utf-8"))["campuses"]

    stops, stop_campus = [], {}
    for r in rows(gtfs / "stops.txt"):
        try:
            lat, lon = float(r["stop_lat"]), float(r["stop_lon"])
        except (KeyError, ValueError):
            continue
        near = []
        for c in cfg:
            d = haversine(lat, lon, c["lat"], c["lon"])
            if d <= c["radius_m"]:
                near.append((c["id"], d))
        if near:
            near.sort(key=lambda x: x[1])
            stop_campus[r["stop_id"]] = near
            stops.append({"id": r["stop_id"], "name": r.get("stop_name", r["stop_id"]),
                          "lat": round(lat, 6), "lon": round(lon, 6),
                          "campus": [n[0] for n in near], "dist": round(near[0][1])})
    if not stops:
        raise RuntimeError("Hiçbir kampüsün yarıçapında durak bulunamadı (config/campuses.json'u kontrol edin)")
    log(f"{len(stops)} kampüs durağı")

    svc = service_days(gtfs)
    trips = {}
    for r in rows(gtfs / "trips.txt"):
        trips[r["trip_id"]] = (r["route_id"], r["service_id"], r.get("trip_headsign", ""))

    route_ids, headsigns = [], []
    ridx, hidx = {}, {}
    sched = {s["id"]: {k: set() for k in DAYTYPES} for s in stops}
    for r in rows(gtfs / "stop_times.txt"):
        sid = r.get("stop_id")
        if sid not in sched:
            continue
        t = trips.get(r.get("trip_id"))
        if not t:
            continue
        m = hhmm(r.get("departure_time") or r.get("arrival_time") or "")
        if m is None:
            continue
        route_id, service_id, head = t
        days = svc.get(service_id)
        if days is None:
            continue
        ri = ridx.setdefault(route_id, len(ridx))
        hi = hidx.setdefault(head, len(hidx))
        for dt, wd in DAYTYPES.items():
            if wd in days:
                sched[sid][dt].add((m, ri, hi))
    route_ids = list(ridx)
    headsigns = list(hidx)

    routes = {}
    for r in rows(gtfs / "routes.txt"):
        if r["route_id"] in ridx:
            routes[r["route_id"]] = {"short": r.get("route_short_name") or r["route_id"], "long": r.get("route_long_name", "")}

    dep = {"routes": route_ids, "headsigns": headsigns, "stops": {}}
    total = 0
    for sid, per in sched.items():
        out = {k: [list(x) for x in sorted(v)] for k, v in per.items()}
        if any(out.values()):
            dep["stops"][sid] = out
            total += len(out["WD"])
    # seferi olmayan durakları listeden çıkar
    stops = [s for s in stops if s["id"] in dep["stops"]]
    if not stops:
        raise RuntimeError("Kampüs duraklarında planlı sefer bulunamadı")

    feed = {}
    fi = gtfs / "feed_info.txt"
    if fi.exists():
        for r in rows(fi):
            feed = {"start": r.get("feed_start_date", ""), "end": r.get("feed_end_date", ""), "version": r.get("feed_version", "")}
            break
    now = datetime.now(TZ)
    meta = {
        "generated_at": now.isoformat(timespec="seconds"),
        "source_url": source_url, "source_page": SOURCE_PAGE, "license": license_name,
        "sample": sample, "feed": feed,
        "counts": {"stops": len(stops), "routes": len(routes), "weekday_departures": total},
    }
    campuses = [{k: c[k] for k in ("id", "name", "lat", "lon", "radius_m")} for c in cfg]

    # Her şey hazır: şimdi yaz (hata olursa eski dosyalar bozulmaz)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, obj in {"stops.json": {"campuses": campuses, "stops": stops}, "routes.json": routes,
                      "departures.json": dep, "meta.json": meta}.items():
        tmp = OUT / (name + ".tmp")
        tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        tmp.replace(OUT / name)
    bundle = {"meta": meta, "campuses": campuses, "stops": stops, "routes": routes, "dep": dep}
    tmp = OUT / "bundle.js.tmp"
    tmp.write_text("window.KUA_DATA=" + json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + ";", encoding="utf-8")
    tmp.replace(OUT / "bundle.js")
    update_history(now, stops, dep, sample)
    log("Yazıldı:", meta["counts"])


def update_history(now, stops, dep, sample):
    """Statik GTFS geçmiş vermez; her çalıştırmada günlük özet biriktirerek kendi zaman serimizi oluştururuz."""
    p = OUT / "history.json"
    hist = json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
    day = now.date().isoformat()
    entry = {"date": day, "sample": sample,
             "stops": len(stops),
             "weekday_departures": sum(len(v["WD"]) for v in dep["stops"].values())}
    hist = [h for h in hist if h["date"] != day] + [entry]
    p.write_text(json.dumps(hist[-365:], ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gtfs-dir", help="indirmek yerine yerel GTFS klasörü kullan")
    ap.add_argument("--sample", action="store_true", help="çıktıyı örnek veri olarak işaretle")
    a = ap.parse_args()
    try:
        if a.gtfs_dir:
            build(Path(a.gtfs_dir), a.sample, "yerel-ornek", "örnek veri")
        else:
            with tempfile.TemporaryDirectory() as td:
                url, lic = download_gtfs(Path(td))
                build(Path(td), False, url, lic)
    except Exception as e:  # noqa: BLE001
        log("HATA:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
