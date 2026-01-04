# 🚀 Projeyi Başlatma

## Hızlı Başlangıç

### 1. Backend'i Başlatın

Önce bir PostgreSQL veritabanı oluşturun:
```sql
CREATE DATABASE soru_havuzu;
```

Backend dizininde `.env` dosyası oluşturun:
```bash
cd backend
copy .env.example .env
```

`.env` dosyasını düzenleyin ve veritabanı bilgilerinizi girin.

Veritabanı tablolarını oluşturun:
```bash
npm run db:migrate
```

Backend'i başlatın:
```bash
npm run dev
```

Backend http://localhost:5000 adresinde çalışacak.

### 2. Frontend'i Başlatın

Yeni bir terminal açın ve frontend dizinine gidin:
```bash
cd frontend
copy .env.example .env
npm run dev
```

Frontend http://localhost:5173 adresinde çalışacak.

### 3. İlk Admin Kullanıcısını Oluşturun

1. Tarayıcıda http://localhost:5173 adresine gidin
2. "Kayıt Ol" butonuna tıklayın
3. Admin rolü ile kayıt olun

## ⚡ Sonraki Adımlar

1. Ekip ve branşlar oluşturun (Admin paneli)
2. Kullanıcılar ekleyin
3. Soru eklemeye başlayın!

Daha detaylı bilgi için [KURULUM.md](KURULUM.md) dosyasına bakın.
