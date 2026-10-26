import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(args, out):
    env = dict(os.environ, OUT_DIR=str(out))
    return subprocess.run([sys.executable, *args], env=env, capture_output=True, text=True)


class Pipeline(unittest.TestCase):
    def test_sample_roundtrip_and_failure_keeps_old_files(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td); gtfs = td / "g"; out = td / "out"
            self.assertEqual(run([ROOT / "scripts/make_sample_gtfs.py", gtfs], out).returncode, 0)
            r = run([ROOT / "scripts/fetch_gtfs.py", "--gtfs-dir", gtfs, "--sample"], out)
            self.assertEqual(r.returncode, 0, r.stderr)
            meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
            self.assertTrue(meta["sample"])
            self.assertEqual(meta["counts"]["stops"], 9)
            dep = json.loads((out / "departures.json").read_text(encoding="utf-8"))
            ege0 = dep["stops"]["ege0"]
            # hat 0: 330..1379 arası 15 dk, hat 1: 25 dk => 70 + 42 = 112 hafta içi kalkış
            self.assertEqual(len(ege0["WD"]), 112)
            self.assertTrue(len(ege0["SA"]) < len(ege0["WD"]))
            self.assertEqual(ege0["WD"], sorted(ege0["WD"]))
            before = (out / "meta.json").read_text(encoding="utf-8")
            bad = run([ROOT / "scripts/fetch_gtfs.py", "--gtfs-dir", td / "yok"], out)
            self.assertEqual(bad.returncode, 1)
            self.assertEqual((out / "meta.json").read_text(encoding="utf-8"), before)

    def test_no_stop_in_radius_is_error(self):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td); g = td / "g"; g.mkdir()
            (g / "stops.txt").write_text("stop_id,stop_name,stop_lat,stop_lon\nx,Uzak,10.0,10.0\n", encoding="utf-8")
            for f, h in {"routes.txt": "route_id", "trips.txt": "route_id,service_id,trip_id", "stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence"}.items():
                (g / f).write_text(h + "\n", encoding="utf-8")
            r = run([ROOT / "scripts/fetch_gtfs.py", "--gtfs-dir", g], td / "o")
            self.assertEqual(r.returncode, 1)
            self.assertIn("durak bulunamadı", r.stderr)


if __name__ == "__main__":
    unittest.main()
