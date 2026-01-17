# 🚀 Render.com'a Deployment Rehberi

## Adım 1: GitHub Repository Oluşturma

1. https://github.com adresine gidin
2. "New repository" butonuna tıklayın
3. Repository adı: `soru-havuzu` (veya istediğiniz ad)
4. Public veya Private seçin
5. **"Create repository"** butonuna tıklayın
6. Açılan sayfada **"…or push an existing repository from the command line"** bölümündeki komutları kopyalayın

## Adım 2: Local Repository'yi GitHub'a Push Etme

Terminalde şu komutları çalıştırın (GitHub'dan kopyaladığınız URL ile):

```bash
cd f:\SoruHavuzu
git remote add origin https://github.com/KULLANICI_ADINIZ/soru-havuzu.git
git branch -M main
git push -u origin main
```

## Adım 3: Cloudinary Hesabı Oluşturma (Ücretsiz)

1. https://cloudinary.com/users/register/free adresine gidin
2. Ücretsiz hesap oluşturun
3. Dashboard'a girin
4. Şu bilgileri not edin:
   - **Cloud Name**
   - **API Key**
   - **API Secret**

## Adım 4: Render.com Deployment

### A) Render.com Hesabı

1. https://render.com adresine gidin
2. GitHub hesabınızla giriş yapın
3. "New +" butonuna tıklayın

### B) PostgreSQL Database Oluşturma

1. "PostgreSQL" seçin
2. Name: `soru-havuzu-db`
3. Database: `soru_havuzu`
4. User: `soru_havuzu_user` (otomatik)
5. Region: `Frankfurt (EU Central)` (size en yakın)
6. **"Free" plan** seçin
7. "Create Database" butonuna tıklayın
8. Oluşan sayfadan **Internal Database URL** veya **External Database URL**'yi kopyalayın

### C) Backend Web Service Oluşturma

1. Dashboard'da "New +" > "Web Service"
2. GitHub repository'nizi bağlayın (`soru-havuzu`)
3. Ayarlar:
   - **Name**: `soru-havuzu-backend`
   - **Region**: Frankfurt (EU Central)
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Environment Variables** ekleyin:
   ```
   NODE_ENV=production
   DATABASE_URL=<PostgreSQL_Internal_URL>
   JWT_SECRET=<güçlü_rastgele_32_karakter>
   JWT_EXPIRE=7d
   CLOUDINARY_CLOUD_NAME=<cloudinary_cloud_name>
   CLOUDINARY_API_KEY=<cloudinary_api_key>
   CLOUDINARY_API_SECRET=<cloudinary_api_secret>
   FRONTEND_URL=https://soruhavuzu.onrender.com
   ```

5. "Create Web Service" butonuna tıklayın
6. Deploy tamamlanana kadar bekleyin (3-5 dakika)

### D) Migration Çalıştırma

Backend deploy olduktan sonra:

1. Backend servisinizin sayfasında "Shell" sekmesine gidin
2. Şu komutu çalıştırın:
   ```bash
   npm run db:migrate
   ```
3. Tabloların oluşturulduğunu kontrol edin

### E) Frontend Static Site Oluşturma

1. Dashboard'da "New +" > "Static Site"
2. Aynı repository'yi seçin
3. Ayarlar:
   - **Name**: `soru-havuzu-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://soru-havuzu-backend.onrender.com/api
   ```
   (Backend URL'inizi buraya yazın)

5. "Create Static Site" butonuna tıklayın

### F) Backend CORS Ayarı Güncelleme

1. Backend servisinizin Environment Variables'ına gidin
2. `FRONTEND_URL` değerini frontend URL'niz ile güncelleyin:
   ```
   FRONTEND_URL=https://soruhavuzu.onrender.com
   ```
3. Servisi yeniden deploy edin (otomatik olacak)

## Adım 5: İlk Kullanım

1. Frontend URL'nize gidin: `https://soruhavuzu.onrender.com`
2. "Kayıt Ol" butonuna tıklayın
3. İlk admin kullanıcısını oluşturun:
   - Ad Soyad: İsminiz
   - Email: Email adresiniz
   - Şifre: Güçlü bir şifre
   - Rol: **Admin**
4. Giriş yapın
5. Ekipler ve branşlar oluşturun
6. Diğer kullanıcıları ekleyin

## ⚠️ Önemli Notlar

### Ücretsiz Plan Sınırlamaları

- **Backend**: 15 dakika hareketsizlikten sonra uyku moduna girer (ilk istekte 30-60 saniye gecikme)
- **Database**: 90 gün sonra silinir (yedekleme yapın!)
- **Bandwidth**: Aylık 100 GB

### Production İçin Öneriler

- Ücretli plana geçin (backend $7/ay, database $7/ay)
- Custom domain ekleyin
- Auto-scaling açın
- Database backup'ları otomatikleştirin

## 🎉 Tamamlandı!

Sisteminiz artık canlıda! URL'leriniz:

- **Frontend**: https://soruhavuzu.onrender.com
- **Backend API**: https://soru-havuzu-backend.onrender.com/api
- **Health Check**: https://soru-havuzu-backend.onrender.com/api/health

## Sorun Giderme

### Build hatası alıyorsanız
- Logs sekmesinden hataları kontrol edin
- Environment variables'ın doğru olduğundan emin olun

### CORS hatası
- Backend'de FRONTEND_URL doğru mu?
- Servisler aynı region'da mı?

### Database bağlantı hatası
- DATABASE_URL doğru kopyalandı mı?
- Internal URL mi kullanıyorsunuz? (önerilir)

### Migration hatası
- Shell'de komutları manuel çalıştırın
- Database erişim izinlerini kontrol edin
