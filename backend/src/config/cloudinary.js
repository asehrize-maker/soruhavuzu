import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
if (!cloudName || cloudName === 'Root') {
  console.warn('⚠️ UYARI: CLOUDINARY_CLOUD_NAME ayarlı değil veya hatalı ("Root"). Lütfen Render dashboard\'dan CLOUDINARY_CLOUD_NAME değişkenini kontrol edin.');
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log(`☁️ Cloudinary yapılandırıldı. Cloud Name (ilk 3 harf): ${cloudName ? cloudName.substring(0, 3) + '...' : 'AYARLI DEĞİL'}`);

export default cloudinary;
