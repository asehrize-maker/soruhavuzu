# Admin kaydi (rol=admin)

Guvenlik nedeniyle admin rolune kayit olabilmek icin bir secret gereklidir.

## 1) Backend ayari

`backend/.env` icine su degiskeni ekleyin:

```
ADMIN_REGISTER_SECRET=degistirin_bu_degeri
```

## 2) UI ile admin kaydi

- `http://localhost:5173/register` sayfasinda `Rol` alanindan `Admin` secin
- `Admin Secret` alanina `ADMIN_REGISTER_SECRET` degerini girin

## 3) API ile admin kaydi (alternatif)

`POST /api/auth/register`

Ornek body:

```json
{
  "ad_soyad": "Admin Kullanici",
  "email": "admin@example.com",
  "sifre": "sifre123",
  "rol": "admin",
  "admin_secret": "degistirin_bu_degeri"
}
```

