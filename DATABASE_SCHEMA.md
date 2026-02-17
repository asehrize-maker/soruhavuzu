# Veritabani Semasi (PostgreSQL)

Bu dokuman, backend/src/database/migrate.js ve 002-033 migration dosyalarina gore **17 Subat 2026** itibariyla hedeflenen tablo semasini ozetler. Alan tipleri PostgreSQL soz dizimiyle, kisitlar ve varsayilanlar kisa tutuldu.

## Tablolarin Ozeti
- ekipler, branslar, kullanicilar, kullanici_branslari
- sorular, dizgi_gecmisi, soru_versiyonlari, soru_yorumlari, soru_revize_notlari
- bildirimler, mesajlar, soru_goruntulenme, kullanici_mesajlari
- brans_kazanimlar, aktivite_loglari, giris_loglari, sistem_ayarlari
- deneme_takvimi, deneme_yuklemeleri

## ekipler
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| ekip_adi | varchar(100) | benzersiz, NOT NULL |
| aciklama | text |  |
| olusturulma_tarihi | timestamp | DEFAULT now() |

## branslar
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| brans_adi | varchar(100) | benzersiz, NOT NULL (global) |
| ekip_id | integer | FK ekipler(id), ON DELETE CASCADE, NULL olabilir |
| aciklama | text |  |
| olusturulma_tarihi | timestamp | DEFAULT now() |

## kullanicilar
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| ad_soyad | varchar(150) | NOT NULL |
| email | varchar(150) | benzersiz, NOT NULL |
| sifre | varchar(255) | NOT NULL |
| rol | varchar(50) | CHECK in {admin,soru_yazici,dizgici,incelemeci,koordinator} |
| inceleme_alanci | boolean | DEFAULT false |
| inceleme_dilci | boolean | DEFAULT false |
| ekip_id | integer | FK ekipler(id) ON DELETE SET NULL |
| brans_id | integer | FK branslar(id) ON DELETE SET NULL |
| aktif | boolean | DEFAULT true |
| son_gorulme | timestamp | DEFAULT now() |
| olusturulma_tarihi | timestamp | DEFAULT now() |
Indeksler: idx_kullanicilar_ekip, idx_kullanicilar_brans.

## kullanici_branslari
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| kullanici_id | integer | FK kullanicilar(id) ON DELETE CASCADE |
| brans_id | integer | FK branslar(id) ON DELETE CASCADE |
| olusturulma_tarihi | timestamp | DEFAULT now() |
Kisitlar: UNIQUE(kullanici_id, brans_id). Indeksler: kullanici_id, brans_id.

## sorular
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| soru_metni | text | NOT NULL |
| fotograf_url | varchar(500) |  |
| fotograf_public_id | varchar(255) |  |
| zorluk_seviyesi | smallint | CHECK 1-5 |
| brans_id | integer | FK branslar(id) ON DELETE CASCADE |
| olusturan_kullanici_id | integer | FK kullanicilar(id) ON DELETE SET NULL |
| durum | varchar(50) | DEFAULT 'beklemede', CHECK listesi (asagida) |
| dizgici_id | integer | FK kullanicilar(id) ON DELETE SET NULL |
| olusturulma_tarihi | timestamp | DEFAULT now() |
| guncellenme_tarihi | timestamp | DEFAULT now() |
| latex_kodu | text |  |
| dizgi_baslama_tarihi | timestamp |  |
| dizgi_bitis_tarihi | timestamp |  |
| revize_notu | text |  |
| dosya_url | varchar(500) |  |
| dosya_public_id | varchar(255) |  |
| dosya_adi | varchar(255) |  |
| dosya_boyutu | integer |  |
| fotograf_konumu | varchar(20) | DEFAULT 'ust', CHECK in {ust,alt,sol,sag} |
| secenek_a | text |  |
| secenek_b | text |  |
| secenek_c | text |  |
| secenek_d | text |  |
| secenek_e | text |  |
| dogru_cevap | varchar(1) | CHECK in {A,B,C,D,E} |
| kazanim | text |  |
| versiyon | integer | DEFAULT 1 |
| onay_alanci | boolean | DEFAULT false |
| onay_dilci | boolean | DEFAULT false |
| final_png_url | varchar(500) |  |
| final_png_public_id | varchar(255) |  |
| dizgi_tamamlanma_tarihi | timestamp |  |
| kategori | varchar(50) | DEFAULT 'deneme' |
Durum degerleri: beklemede, dizgi_bekliyor, dizgide, dizgi_tamam, alan_incelemede, alan_onaylandi, dil_incelemede, dil_onaylandi, revize_istendi, revize_gerekli, inceleme_bekliyor, incelemede, inceleme_tamam, tamamlandi, arsiv.
Indeksler: idx_sorular_durum, idx_sorular_brans, idx_sorular_kategori.

## dizgi_gecmisi
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| soru_id | integer | FK sorular(id) ON DELETE CASCADE |
| dizgici_id | integer | FK kullanicilar(id) ON DELETE SET NULL |
| durum | varchar(50) |  |
| notlar | text |  |
| tamamlanma_tarihi | timestamp | DEFAULT now() |

## bildirimler
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| kullanici_id | integer | FK kullanicilar(id) ON DELETE CASCADE |
| baslik | varchar(200) | NOT NULL |
| mesaj | text | NOT NULL |
| tip | varchar(50) | NOT NULL |
| okundu | boolean | DEFAULT false |
| link | varchar(500) |  |
| olusturulma_tarihi | timestamp | DEFAULT now() |
Indeksler: idx_bildirimler_kullanici, idx_bildirimler_okundu.

## mesajlar
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| soru_id | integer | FK sorular(id) ON DELETE CASCADE |
| gonderen_id | integer | FK kullanicilar(id) ON DELETE CASCADE |
| mesaj | text | NOT NULL |
| dosya_url | varchar(500) |  |
| olusturulma_tarihi | timestamp | DEFAULT now() |
Indeksler: idx_mesajlar_soru, idx_mesajlar_gonderen.

## soru_goruntulenme
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| soru_id | integer | FK sorular(id) ON DELETE CASCADE |
| kullanici_id | integer | FK kullanicilar(id) ON DELETE CASCADE |
| goruntuleme_tarihi | timestamp | DEFAULT now() |
Kisit: UNIQUE(soru_id, kullanici_id).

## kullanici_mesajlari
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| gonderen_id | integer | FK kullanicilar(id) ON DELETE CASCADE |
| alici_id | integer | FK kullanicilar(id) ON DELETE CASCADE |
| mesaj | text | NOT NULL |
| dosya_url | varchar(500) |  |
| okundu | boolean | DEFAULT false |
| olusturulma_tarihi | timestamp | DEFAULT now() |
Indeksler: gonderen_id, alici_id, okundu.

## soru_versiyonlari
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| soru_id | integer | FK sorular(id) ON DELETE CASCADE |
| versiyon_no | integer | NOT NULL |
| data | jsonb | NOT NULL (tam yedek) |
| degistiren_kullanici_id | integer | FK kullanicilar(id) |
| degisim_tarihi | timestamp | DEFAULT now() |
| degisim_aciklamasi | text |  |

## soru_yorumlari
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| soru_id | integer | FK sorular(id) ON DELETE CASCADE |
| kullanici_id | integer | FK kullanicilar(id) |
| yorum_metni | text | NOT NULL |
| tarih | timestamp | DEFAULT now() |
| okundu | boolean | DEFAULT false |

## soru_revize_notlari
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| soru_id | integer | FK sorular(id) ON DELETE CASCADE |
| kullanici_id | integer | FK kullanicilar(id) |
| secilen_metin | text | NOT NULL |
| not_metni | text | NOT NULL |
| inceleme_turu | varchar(20) | CHECK in {alanci,dilci} |
| cozuldu | boolean | DEFAULT false |
| tarih | timestamptz | DEFAULT now() |

## brans_kazanimlar
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| brans_id | integer | FK branslar(id) ON DELETE CASCADE |
| kod | varchar(100) |  |
| aciklama | text |  |
| created_at | timestamp | DEFAULT now() |
Kisit: UNIQUE(brans_id, kod).

## aktivite_loglari
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| kullanici_id | integer | FK kullanicilar(id) ON DELETE SET NULL |
| soru_id | integer | FK sorular(id) ON DELETE SET NULL |
| islem_turu | varchar(50) | NOT NULL |
| aciklama | text | NOT NULL |
| detay | jsonb |  |
| tarih | timestamp | DEFAULT now() |
Indeksler: idx_aktivite_tarih, idx_aktivite_kullanici.

## giris_loglari
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| kullanici_id | integer | FK kullanicilar(id) ON DELETE SET NULL |
| ip_adresi | varchar(45) |  |
| user_agent | text |  |
| tarih | timestamp | DEFAULT now() |
Indeks: idx_giris_tarih.

## sistem_ayarlari
| Kolon | Tip | Not |
| --- | --- | --- |
| anahtar | varchar(100) | PRIMARY KEY |
| deger | text |  |
| aciklamalar | text |  |
| guncellenme_tarihi | timestamp | DEFAULT now() |

## deneme_takvimi
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| ad | varchar(255) | NOT NULL |
| planlanan_tarih | date | NOT NULL |
| aciklama | text |  |
| aktif | boolean | DEFAULT true |
| olusturan_id | integer | FK kullanicilar(id) |
| olusturma_tarihi | timestamp | DEFAULT now() |
| gorev_tipi | varchar(50) | DEFAULT 'deneme' |

## deneme_yuklemeleri
| Kolon | Tip | Not |
| --- | --- | --- |
| id | serial PK |  |
| deneme_id | integer | FK deneme_takvimi(id) ON DELETE CASCADE |
| brans_id | integer | FK branslar(id) ON DELETE CASCADE |
| dosya_url | text | NOT NULL |
| yukleyen_id | integer | FK kullanicilar(id) |
| yukleme_tarihi | timestamp | DEFAULT now() |

### Notlar
- Tum durum/rol listeleri migration 025 ve 024 ile son halini aldi; uygulama tarafinda ayni seti kullanmak gerekir.
- kullanici_ekipleri icin ayri bir migration (027_add_kullanici_ekipleri.js) mevcut olsa da migrate.js icinde cagrilmadigi icin aktif semaya dahil edilmedi.
- En guncel indeksler yukarida tablo altinda ozetlenmistir; Postgres kendi PK/UK indekslerini otomatik olusturur.
