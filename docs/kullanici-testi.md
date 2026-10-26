# Kullanıcı testi şablonu

Hedef: kullanıcıya benzeyen **en az 2 kişi**, **3 görev**. Her görevde: başarılı mı, kaç saniye, nerede takıldı. Gerçek sonuçları yazın; doldurulmamış satırı teslim etmeyin.

## Görevler (öneri)
1. "Ege Üniversitesi kampüsü yakınındaki bir durak seçin ve oradan kalkacak **ilk otobüsün saatini** söyleyin."
2. "Yalnızca belirli bir hattı filtreleyin ve o hattın **sonraki seferine kaç dakika** kaldığını söyleyin."
3. "Pazar günü bu durakta **günün en yoğun saatinin** ne zaman olduğunu bulun."

## Kayıt tablosu
| Katılımcı (kod, ör. K1) | Profil (ör. ekran okuyucu kullanıcısı / görme engelli yakını / öğrenci) | Görev | Başarılı? | Süre (sn) | Nerede takıldı / not |
|---|---|---|---|---|---|
| K1 | | 1 | | | |
| K1 | | 2 | | | |
| K1 | | 3 | | | |
| K2 | | 1 | | | |
| K2 | | 2 | | | |
| K2 | | 3 | | | |

Kişisel veri yazmayın (isim yerine kod kullanın).

## Testten sonra yapılacak değişiklik
- Takılma noktası: …
- Yapılan değişiklik: …
- Önce / sonra ekran görüntüsü: `docs/onceki.png`, `docs/sonraki.png`

## Ekran okuyucu test videosu (30 sn)
VoiceOver (macOS/iOS) veya NVDA (Windows) ile **görev 1**'i kaydedin; vaka sayfasına gömün.

---
# Teslim kontrol listesi
- [ ] Canlı ürün linki açılıyor, "Son güncelleme" görünüyor
- [ ] GitHub deposu herkese açık; ≥15 commit, ≥4 farklı gün
- [ ] Actions günlük çalışıyor (en az bir başarılı çalıştırma), anahtar gerekmiyor/Secrets'ta
- [ ] Portfolyo vaka sayfası + proje kartı (canlı link + GitHub linki)
- [ ] 60–90 sn demo videosu
- [ ] Lighthouse mobil ekran görüntüsü (Erişilebilirlik ≥90, Performans ≥80)
- [ ] README: CV cümlesi (gerçek Lighthouse değerleriyle) ve YZ beyanı (kendi yaptıklarınızla)
- [ ] Kullanıcı testi bulguları + önce/sonra görseli
- [ ] 360 px ve 1440 px görünümü kontrol edildi
- [ ] Ağ kapalı / `?dataBase=/yok/` ile hata durumu denendi
- [ ] **26 Ekim 23:59 ara kontrol:** depo linki + ilk otomatik veri çekimi çalışıyor + taslak fotoğrafı
