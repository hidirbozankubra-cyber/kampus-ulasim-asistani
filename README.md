# Kampüs Ulaşım Asistanı

Derse yetişmeye çalışan öğrenciler (görme engelli öğrenciler dahil) için, İzmir ESHOT GTFS tarifesinden seçilen kampüs duraklarının **sonraki 3 seferini** gösteren, ekran okuyucu öncelikli web uygulaması.
BVA 2245 Kullanıcı Arayüzü Tasarımı · Haftalık Sprint · Kübra Hıdırbozan (2516016030)

- **Canlı ürün:** `<CANLI-LİNK-BURAYA>`
- **Portfolyo vaka çalışması:** `<VAKA-SAYFASI-LİNKİ>`
- **Demo videosu:** `<VİDEO-LİNKİ>`

> Öğrenci projesidir; resmî ESHOT veya İzmir Büyükşehir Belediyesi aracı değildir. Gösterilen saatler **planlı tarifedir**, canlı konum/gecikme içermez. Bilgilendirme amaçlıdır.

## CV cümlesi

> İzmir ESHOT GTFS tarifesini GitHub Actions ile günlük işleyip kampüs durakları için "sonraki 3 sefer" hesaplayan, ekran okuyucu öncelikli erişilebilir bir karar panosu geliştirdim (Python, Chart.js, SVG harita, PWA; Lighthouse erişilebilirlik **XX**, performans **YY**).

(XX / YY değerlerini canlı ürünü Lighthouse'ta ölçtükten sonra gerçek sonuçlarla doldurun; ölçmediğiniz bir sayıyı yazmayın.)

## Mimari

```
İzmir Açık Veri Portalı (CKAN)          GitHub Actions (günlük cron, 02:17 UTC)
 toplu-ulasim-gtfs-verileri  ───────►   scripts/fetch_gtfs.py
   (GTFS zip / .txt)                       │ 1. kaynağı CKAN API'den bulur, indirir
                                           │ 2. kampüs yarıçapındaki durakları süzer (config/campuses.json)
                                           │ 3. stop_times'ı gün türüne (hafta içi/Cmt/Pazar) göre toplar
                                           ▼
                                   public/data/*.json  ──► git commit ──► statik yayın (Vercel / Pages)
                                   (meta, stops, routes,                         │
                                    departures, history)                         ▼
                                                                   Tarayıcı: index.html + app.js
                                                                   • sonraki 3 sefer  • saatlik sıklık grafiği
                                                                   • hat grafiği      • harita + liste + tablo
                                                                   Service Worker: ağ yoksa son başarılı veri
```

- **Neden önceden işleme?** ESHOT GTFS dosyası milyonlarca `stop_times` satırı içerir; tarayıcıya yalnızca kampüs duraklarının küçük özetini (≈ yüzlerce KB) göndermek hızlı ve çevrimdışı çalışır.
- **Gün türü:** Hafta içi = Çarşamba, Cumartesi, Pazar tarifesi temsilci gün olarak alınır. `calendar_dates.txt` içindeki özel gün istisnaları (bayram vb.) **işlenmez** — bilinen sınırlama.
- **Gece seferleri:** 24:00 sonrası kalkışlar (`25:10:00`) bir önceki günün tarifesinden bugünün başına taşınır.
- **Zaman damgası:** Ekranda "Son güncelleme" `meta.json → generated_at` değerinden gelir (İstanbul saati).
- **Snapshot:** GTFS geçmiş vermez; her çalıştırmada `public/data/history.json` içine günlük özet eklenir (en fazla 365 gün).
- **API anahtarı:** Bu kaynak anahtar gerektirmez. Anahtarlı bir kaynak eklerseniz GitHub Secrets'ta tutun, yalnızca Actions içinde kullanın; istemci koduna yazmayın.

## Veri kaynağı ve lisans

İzmir Büyükşehir Belediyesi Açık Veri Portalı — Toplu Ulaşım GTFS Verileri: <https://acikveri.bizizmir.com/tr/dataset/toplu-ulasim-gtfs-verileri>
Veri dosyası: Otobüs GTFS verileri (ESHOT) — <https://www.eshot.gov.tr/gtfs/bus-eshot-gtfs.zip>
Lisans: İzmir Büyükşehir Belediyesi Açık Veri Lisansı; portal ayrıca CC BY 4.0 (atıf) belirtiyor. Veri seti sayfasındaki güncel lisans metnini yayından önce kontrol edin. Veri seti güncelleme sıklığı "düzensiz" (sayfada son güncelleme: 3 Nisan 2026). Harita: © OpenStreetMap katkıda bulunanlar.

## Windows'ta hızlı başlatma

Zip'i **önce klasöre çıkarın** (WinRAR içinden açmayın), sonra `baslat.bat` dosyasına çift tıklayın; tarayıcı `http://localhost:8080` adresinde açılır (Python gerekir: python.org). `index.html`'yi doğrudan çift tıklayarak açmayın; tarayıcılar `file://` üzerinde modülleri ve veri dosyalarını engeller.

## Kurulum

```bash
# 1) Örnek (uydurma) veriyle yerelde dene — gerçek veri DEĞİLDİR, ekranda uyarı bandı çıkar
npm run data:sample
npm run serve            # http://localhost:8080

# 2) Gerçek veriyi çek
python3 scripts/fetch_gtfs.py                 # CKAN'dan kaynağı kendisi bulur
GTFS_URL="https://.../gtfs.zip" python3 scripts/fetch_gtfs.py   # adresi elle verin

# 3) Testler
npm test
```

GitHub'da önce `Settings → Actions → General → Workflow permissions → Read and write permissions` seçin (veriyi depoya yazabilmek için). Sonra `Actions → GTFS verisini güncelle → Run workflow` ile ilk çekimi elle başlatın. Adres varsayılan olarak `bus-eshot-gtfs.zip`'tir; değişirse `Settings → Secrets and variables → Actions → Variables` altına `GTFS_URL` ekleyin.
**Not:** İndirme yolu yerel zip ile test edildi; gerçek 19 MB'lık ESHOT dosyasıyla ilk çalıştırmayı GitHub Actions'ta siz görmüş olacaksınız. Zip güvenliği: indirme 300 MB, açılmış boyut 2 GB ile sınırlıdır; yalnızca beklenen `.txt` dosyaları ve yalnızca dosya adı kullanılarak çıkarılır (Zip Slip'e karşı).

Demo sırasında hata durumunu denemek için: `?dataBase=/yok/` ekleyin (veri adresini bozar), ya da tarayıcıda ağı kapatın — servis çalışanı son başarılı veriyi gösterir ve bandla bildirir.

## Tasarım sistemi

Renk, tipografi ve kart dili, portfolyodaki "Türkiye'de sosyal ağ kullanımı" (Eurostat) veri hikâyesinden alındı: koyu zemin `#151015`, pudra-gül vurgu `#EBA8BB` / `#F2BDCB`, Georgia başlıklar, sol çizgili kartlar, `#9CC9FF` odak halkası. Token'lar `public/styles.css` başında.

## Erişilebilirlik

Klavyeyle tüm kontroller kullanılabilir; odak görünür; "Ana içeriğe geç" bağlantısı; her grafiğin yanında otomatik tek cümlelik özet ve "tablo olarak gör"; seçili durak haritada renk + boyut + kalın halka ile gösterilir (renk tek başına anlam taşımaz); harita noktaları klavyeyle de seçilebilir (Tab + Enter) ve aynı bilgi listede de vardır; sonraki seferler kullanıcı bir seçim yaptığında ekran okuyucuya tek cümleyle duyurulur (otomatik tazelemede rahatsız etmez).

## Yapay zekâ kullanım beyanı

> **Bu bölümü kendi yaptıklarınıza göre düzenleyin; demoda açıklayamayacağınız hiçbir satırı bırakmayın.**

- **Araç:** Claude (Anthropic).
- **Ne için:** Veri hattı (`scripts/fetch_gtfs.py`, GitHub Actions iş akışı), `app.js`, `js/lib.js`, `styles.css`, `sw.js`, testler ve doküman taslakları Claude ile üretildi. Başlangıç noktası, öğrencinin kendi hazırladığı `index.html` iskeletiydi; Claude bunu koruyup kampüs/saat alanları, ikinci grafik, durum bandı ve manifest ekledi.
- **Öğrencinin yaptığı:** `<buraya kendi değişikliklerinizi yazın: ör. kampüs koordinatlarını düzelttim, renkleri portfolyo token'larıyla değiştirdim, kullanıcı testini yaptım…>`
- **Doğrulama:** Birim testleri (`npm test`) ve örnek veriyle uçtan uca hat testi çalıştırıldı; tarayıcıda görsel/Lighthouse testi öğrenci tarafından yapılacak.

## Dizin

```
config/campuses.json      kampüs merkezleri ve yarıçapları (koordinatlar yaklaşık, kontrol edin)
scripts/fetch_gtfs.py     GTFS → JSON hattı          scripts/make_sample_gtfs.py  yalnız test için uydurma veri
.github/workflows/        günlük zamanlanmış görev
public/                   statik site (index.html, app.js, js/lib.js, styles.css, sw.js, data/)
tests/                    node:test + unittest
docs/                     vaka çalışması taslağı, kullanıcı testi şablonu, teslim kontrol listesi
```
