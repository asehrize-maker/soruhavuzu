import pool from './src/config/database.js';

const debugDeneme = async () => {
    try {
        console.log('Checking database...');
        const res = await pool.query("SELECT to_regclass('public.deneme_takvimi')");
        console.log('Table Exists?', res.rows[0].to_regclass);

        if (res.rows[0].to_regclass) {
            console.log('Table columns:');
            const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deneme_takvimi'");
            cols.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
        } else {
            console.log('Table does not exist! Running creation manually...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS deneme_takvimi (
                    id SERIAL PRIMARY KEY,
                    ad VARCHAR(255) NOT NULL,
                    planlanan_tarih DATE NOT NULL,
                    aciklama TEXT,
                    aktif BOOLEAN DEFAULT true,
                    olusturan_id INTEGER, 
                    olusturma_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS deneme_yuklemeleri (
                    id SERIAL PRIMARY KEY,
                    deneme_id INTEGER REFERENCES deneme_takvimi(id) ON DELETE CASCADE,
                    brans_id INTEGER,
                    dosya_url TEXT NOT NULL,
                    yukleyen_id INTEGER,
                    yukleme_tarihi TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('Tables created manually.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        pool.end();
    }
};

debugDeneme();
