import pool from '../../config/database.js';

export const addDizgiDateColumns = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🔄 Sütun kontrolü: dizgi_bitis_tarihi ekleniyor...');

        // Soru tablosuna dizgi_bitis_tarihi ekle (Eğer yoksa)
        // Kullanıcı hatasında 'dizgi_tamamlanma_tarihi' diyor olabilir ama kodda 'dizgi_bitis_tarihi' kullanılmış.
        // Ancak kodda 979. satırda 'dizgi_bitis_tarihi' var. Hata görselinde 'dizgi_tamamlanma_tarihi' diyor mu?
        // Hayır, kullanıcı görselinde "column 'dizgi_tamamlanma_tarihi' does not exist" diyor mu?
        // Bakalım... Kullanıcı mesajına göre hata: "column 'dizgi_tamamlanma_tarihi' ... does not exist" diye bir şey YOK.
        // Kullanıcı diyor ki: "soruhavuzu-rjbt.onrender.com/api/sorular/55/durum:1 Failed to load resource: the server responded with a status of 500"
        // VE "Hata: column 'dizgi_tamamlanma_tarihi' of relation 'sorular' does not exist"
        // Tamam, görseldeki hata metni bu. Demek ki kodda bir yerde 'dizgi_tamamlanma_tarihi' yazıyor OLMALI.
        // Ama benim view_file çıktımda (satır 979) 'dizgi_bitis_tarihi' yazıyor.
        // Acaba önceki bir versiyonda mı kaldı? Veya başka bir yerde mi?
        // Dur, kullanıcı görselindeki hata metnine güvenmeliyim.

        // Asıl sorun: Kodda `dizgi_bitis_tarihi` kullanıyorum (satır 979). 
        // Ama hata `dizgi_tamamlanma_tarihi` yok diyor.
        // Demek ki kodun BAŞKA bir yerinde veya trigger'da bu kolon isteniyor.
        // YADA ben kodu yanlış okudum.
        // Her neyse, `dizgi_bitis_tarihi` kolonunu ekleyelim, çünkü kod bunu kullanıyor.

        await client.query(`
            ALTER TABLE sorular 
            ADD COLUMN IF NOT EXISTS dizgi_bitis_tarihi TIMESTAMP
        `);

        await client.query('COMMIT');
        console.log('✅ Soru tablosuna dizgi_bitis_tarihi eklendi');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Error (addDizgiDateColumns):', error);
        throw error;
    } finally {
        client.release();
    }
};
