# GitHub ve Vercel

Bu pakette yüklenen gerçek ESHOT GTFS dosyası işlendi. 131 kampüs durağı, 69 hat ve 20.951 hafta içi durak-kalkış kaydı bulunuyor. sample=false. Anlık araç konumu/gecikmesi içermez.

ÖNEMLİ: Kaynaktaki servislerin bitiş tarihleri 5–9 Ekim 2026. Bu yüzden güncel ulaşım bilgisi olarak kullanılamaz. Kullanıcı isteğiyle tarife süresi uyarısı arayüzden kaldırılmıştır; geçerlilik tarihleri meta.json içinde korunur. Yeni dosya indirmenin kendisi tarifenin güncellendiği anlamına gelmez.

1. ZIP'i çıkarın. İçindeki klasörün İÇERİĞİNİ, alt klasörleri koruyarak GitHub'a yükleyin. Özellikle .github/workflows/update-gtfs.yml bulunmalı.
2. Vercel: kök ./, Framework Other, çıktı public; derleme ve yükleme komutları boş. vercel.json bu ayarları içerir.
3. GitHub Settings > Actions > General > Workflow permissions > Read and write permissions.
4. Actions > GTFS verisini güncelle > Run workflow. Başarısızsa mevcut veri korunur. Başarılı olsa bile meta.json içindeki feed.end tarihini kontrol edin.
5. GitHub'da veri güncellendiğinde Vercel Deployments bölümünden yeni dağıtımın oluştuğunu kontrol edin; oluşmazsa Redeploy yapın.

Doğrulama: Gerçek GTFS dosyasının işlenmesi ve 12 birim testi başarılı. Tarayıcı/Lighthouse ve anlık veri entegrasyonu doğrulanmadı.
