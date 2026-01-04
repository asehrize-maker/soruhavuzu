# Soru Havuzu Sistemi - Kurulum Rehberi

## Gereksinimler

- Node.js 18+
- PostgreSQL 14+
- npm veya yarn

## Yerel Kurulum

### 1. Repository'yi klonlayın

```bash
git clone <repository-url>
cd SoruHavuzu
```

### 2. Backend Kurulumu

```bash
cd backend
npm install
```

`.env` dosyası oluşturun (`.env.example`'dan kopyalayın):

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin ve gerekli değerleri girin.

### 3. PostgreSQL Veritabanı Oluşturma

```sql
CREATE DATABASE soru_havuzu;
```

### 4. Veritabanı Migration

```bash
npm run db:migrate
```

### 5. Backend'i Başlatma

```bash
npm run dev
```

Backend http://localhost:5000 adresinde çalışacak.

### 6. Frontend Kurulumu

Yeni bir terminal açın:

```bash
cd frontend
npm install
```

`.env` dosyası oluşturun:

```bash
cp .env.example .env
```

### 7. Frontend'i Başlatma

```bash
npm run dev
```

Frontend http://localhost:5173 adresinde çalışacak.

## İlk Kullanıcı Oluşturma

1. Tarayıcıda http://localhost:5173/register adresine gidin
2. Admin rolü ile kayıt olun
3. Ekip ve branşlar oluşturun
4. Diğer kullanıcıları ekleyin

## Test için Örnek Veri

Backend çalışırken API endpoint'lerini kullanarak test verisi ekleyebilirsiniz:

```bash
# Ekip oluşturma
curl -X POST http://localhost:5000/api/ekipler \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ekip_adi": "Matematik Ekibi", "aciklama": "Matematik soruları hazırlayan ekip"}'

# Branş oluşturma
curl -X POST http://localhost:5000/api/branslar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"brans_adi": "Geometri", "ekip_id": 1, "aciklama": "Geometri soruları"}'
```

## Sorun Giderme

### Backend bağlantı hatası
- PostgreSQL'in çalıştığından emin olun
- `.env` dosyasındaki `DATABASE_URL`'in doğru olduğunu kontrol edin

### Cloudinary hatası
- Cloudinary hesabınızın aktif olduğundan emin olun
- API key'lerin doğru girildiğini kontrol edin

### CORS hatası
- Backend'deki `FRONTEND_URL` environment variable'ının doğru olduğundan emin olun

## Production Build

### Backend
```bash
cd backend
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## Daha Fazla Bilgi

- [Deployment Rehberi](DEPLOYMENT.md)
- [API Dokümantasyonu](API_DOCS.md) (yakında)
