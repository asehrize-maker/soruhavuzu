
const createDenemelerTables = async (client) => {
    try {
        // Deneme Takvimi (Planları)
        await client.query(`
      CREATE TABLE IF NOT EXISTS deneme_takvimi (
        id SERIAL PRIMARY KEY,
        ad VARCHAR(255) NOT NULL,
        planlanan_tarih DATE NOT NULL,
        aciklama TEXT,
        aktif BOOLEAN DEFAULT true,
        olusturan_id INTEGER REFERENCES kullanicilar(id),
        olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Deneme Yüklemeleri
        await client.query(`
      CREATE TABLE IF NOT EXISTS deneme_yuklemeleri (
        id SERIAL PRIMARY KEY,
        deneme_id INTEGER REFERENCES deneme_takvimi(id) ON DELETE CASCADE,
        brans_id INTEGER REFERENCES branslar(id) ON DELETE CASCADE,
        dosya_url TEXT NOT NULL,
        yukleyen_id INTEGER REFERENCES kullanicilar(id),
        yukleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Brans constraint: Bir denemeye bir branş sadece bir dosya yükleyebilir (veya revize için birden fazla olabilir,
        // ama ajanda mantığı için son yüklemeye bakacağız veya unique constraint koyabiliriz.
        // Şimdilik unique constraint koymuyoruz, çoklu yükleme olabilir, en sonuncuyu baz alırız.)

        console.log('Deneme tabloları oluşturuldu.');
    } catch (error) {
        console.error('Deneme tabloları oluşturulurken hata:', error);
        throw error;
    }
};

export default createDenemelerTables;
