#!/usr/bin/env python3
"""YALNIZCA GELİŞTİRME/TEST için uydurma GTFS üretir. Gerçek ESHOT verisi DEĞİLDİR.
Kullanım: python scripts/make_sample_gtfs.py ornek_gtfs"""
import csv, json, sys
from pathlib import Path

out = Path(sys.argv[1] if len(sys.argv) > 1 else "ornek_gtfs")
out.mkdir(parents=True, exist_ok=True)
root = Path(__file__).resolve().parent.parent
cfg = json.loads((root / "config" / "campuses.json").read_text(encoding="utf-8"))["campuses"]


def w(name, header, data):
    with open(out / name, "w", newline="", encoding="utf-8") as f:
        c = csv.writer(f); c.writerow(header); c.writerows(data)


stops, routes, trips, st = [], [], [], []
tid = 0
for ci, c in enumerate(cfg):
    for k in range(3):
        sid = f"{c['id']}{k}"
        stops.append([sid, f"ÖRNEK {c['name'].split(' (')[0]} Durağı {k + 1}", c["lat"] + 0.002 * k, c["lon"] + 0.002 * k])
    for r in range(2):
        rid = f"R{ci}{r}"
        routes.append([rid, f"{ci}{r}{5}", f"Örnek Hat {ci}{r}"])
        for svc, (start, end, gap) in {"WD": (330, 1380, 15 + 10 * r), "SA": (390, 1320, 30), "SU": (450, 1260, 40)}.items():
            for m in range(start, end, gap):
                tid += 1
                t = f"T{tid}"
                trips.append([rid, svc, t, "Merkez" if r == 0 else "Kampüs"])
                for k in range(3):
                    mm = m + k * 3
                    hh = f"{mm // 60:02d}:{mm % 60:02d}:00"
                    st.append([t, hh, hh, f"{c['id']}{k}", k + 1])
w("stops.txt", ["stop_id", "stop_name", "stop_lat", "stop_lon"], stops)
w("routes.txt", ["route_id", "route_short_name", "route_long_name"], routes)
w("trips.txt", ["route_id", "service_id", "trip_id", "trip_headsign"], trips)
w("stop_times.txt", ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"], st)
w("calendar.txt", ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"],
  [["WD", 1, 1, 1, 1, 1, 0, 0, "20260901", "20270131"], ["SA", 0, 0, 0, 0, 0, 1, 0, "20260901", "20270131"], ["SU", 0, 0, 0, 0, 0, 0, 1, "20260901", "20270131"]])
w("feed_info.txt", ["feed_publisher_name", "feed_start_date", "feed_end_date", "feed_version"], [["ornek", "20260901", "20270131", "ornek-1"]])
print("Örnek GTFS yazıldı:", out)
