# Render.com Deployment Rehberi

## Backend Deployment

1. **Web Service Oluşturma**
   - Render.com'da "New Web Service" seçin
   - GitHub repository'nizi bağlayın
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

2. **Environment Variables**
   ```
   NODE_ENV=production
   DATABASE_URL=<postgresql_url>
   JWT_SECRET=<güçlü_bir_secret_key>
   JWT_EXPIRE=7d
   CLOUDINARY_CLOUD_NAME=<cloudinary_cloud_name>
   CLOUDINARY_API_KEY=<cloudinary_api_key>
   CLOUDINARY_API_SECRET=<cloudinary_api_secret>
   FRONTEND_URL=https://your-frontend-url.onrender.com
   ```

3. **PostgreSQL Database Oluşturma**
   - "New PostgreSQL" seçin
   - Database adı: `soru_havuzu_db`
   - Oluşturulan `DATABASE_URL`'yi backend environment variables'a ekleyin

4. **Migration Çalıştırma**
   - Backend deploy olduktan sonra Shell'de:
   ```bash
   npm run db:migrate
   ```

## Frontend Deployment

1. **Static Site Oluşturma**
   - "New Static Site" seçin
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

2. **Environment Variables**
   ```
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```

## Deployment Sonrası

1. Backend URL'yi frontend environment variable'larına ekleyin
2. Frontend URL'yi backend CORS ayarlarına ekleyin
3. İlk admin kullanıcısını oluşturun:
   ```bash
   POST https://your-backend-url.onrender.com/api/auth/register
   {
     "ad_soyad": "Admin",
     "email": "admin@example.com",
     "sifre": "admin123456",
     "rol": "admin"
   }
   ```

## Cloudinary Kurulumu

1. https://cloudinary.com adresinden ücretsiz hesap oluşturun
2. Dashboard'dan şu bilgileri alın:
   - Cloud Name
   - API Key
   - API Secret
3. Bu bilgileri backend environment variables'a ekleyin

## İpuçları

- Render.com ücretsiz planında servisler 15 dakika hareketsizlik sonrası uyku moduna girer
- İlk istekte 1-2 dakika gecikmesi olabilir
- PostgreSQL ücretsiz veritabanı 90 gün sonra silinir (yedekleme yapın)
- Production için ücretli plana geçmeniz önerilir
