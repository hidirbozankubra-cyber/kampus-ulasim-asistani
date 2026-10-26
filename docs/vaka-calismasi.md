# Vaka çalışması taslağı — Kampüs Ulaşım Asistanı

> Taslak. `<…>` işaretli yerleri gerçek bulgularınızla doldurun; yapmadığınız testi yapılmış gibi yazmayın. Müşteri kurgusaldır (bir üniversite öğrenci konseyi); gerçek kurumla iş birliği varmış gibi sunmayın.

## 1. Problem
Derse yetişmeye çalışan bir öğrenci için "bir sonraki otobüs ne zaman?" sorusu hızlı yanıtlanmalı. Görme engelli öğrenciler için bu bilgi çoğu zaman harita ve renk odaklı arayüzlerde zor erişilir. Hedef: tek bir duraktan **sonraki 3 seferi** ekran okuyucuyla birkaç adımda öğrenebilmek.

## 2. Kullanıcı ve müşteri
- Müşteri (kurgusal): bir üniversite öğrenci konseyi.
- Kullanıcı: derse yetişmeye çalışan öğrenci; ekran okuyucu (VoiceOver/NVDA) kullananlar dahil.

## 3. Tasarım kararları
- **Ekran okuyucu öncelikli:** önce liste/metin, harita ikincil. Gerekçe: harita işaretleri klavyeyle gezilemez; aynı bilgi listede.
- **Portfolyo tasarım sistemiyle çelişki:** `<varsa yazın: ör. portfolyodaki X rengi kontrastı 4.5:1'in altında kaldığı için Y kullandım; kısıt önceliklidir>`.
- **Neden planlı tarife, canlı değil:** GTFS statik tarifedir; bunu arayüzde açıkça söylüyoruz (güven için).
- **Duyuru stratejisi:** seçim değişince tek cümlelik özet okunur; saniyelik otomatik tazelemede okunmaz.

## 4. Veri hattı mimarisi
README'deki şemayı yerleştirin (basit kutu-ok görseli): Açık veri portalı → GitHub Actions (günlük) → JSON → statik site → tarayıcı + servis çalışanı.

## 5. Ekranlar
`<Ana ekran, sonraki 3 sefer, grafikler, harita+liste, hata ve boş durum ekran görüntüleri>`

## 6. Kullanıcı testi bulguları
`docs/kullanici-testi.md` tablosundaki sonuçları özetleyin + önce/sonra görseli.

## 7. Sonuç
`<Lighthouse mobil: Erişilebilirlik __ / Performans __; test başarı oranı __>`

## 8. Bir haftam daha olsaydı
- Özel gün (bayram) takvimi (`calendar_dates.txt`) desteği
- Durağa yürüme mesafesi / kullanıcının konumuna en yakın durak (konum izni ile, veri saklanmadan)
- TR/EN dil desteği
- Gerçek zamanlı otobüs konumu için resmî API'ye bağlanma (kullanım koşulları uygunsa)
