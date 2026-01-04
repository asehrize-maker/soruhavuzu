# Soru Havuzu Sistemi

Ekipler, branşlar ve öğretmenler için soru yönetim sistemi.

## Proje Yapısı

- `backend/` - Node.js + Express API
- `frontend/` - React + Vite uygulaması

## Teknoloji Stack

### Backend
- Node.js + Express
- PostgreSQL
- JWT Authentication
- Cloudinary (Fotoğraf depolama)

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router
- Axios

## Kurulum

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

### Backend (.env)
```
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:5000/api
```

## Deployment (Render.com)

1. Backend: Web Service
2. Frontend: Static Site
3. Database: PostgreSQL

## Özellikler

- ✅ Kullanıcı yönetimi (Admin, Soru Yazıcı, Dizgici)
- ✅ Ekip ve branş yönetimi
- ✅ Soru ekleme ve düzenleme
- ✅ Fotoğraf yükleme (Cloudinary)
- ✅ Dizgi sistemi
- ✅ Raporlama ve istatistikler
