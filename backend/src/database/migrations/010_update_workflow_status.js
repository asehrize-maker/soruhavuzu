import pool from '../../config/database.js';

export const updateWorkflowStatus = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Mevcut constraint adını bulmaya çalışalım veya varsayılanı düşürelim.
        // Genelde sorular_durum_check olur.
        // Hata almamak için önce constrainti kaldırmayı deneyelim.

        try {
            await client.query('ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check');
        } catch (e) {
            console.log('Constraint silinemedi (önemsiz olabilir):', e.message);
        }

        // Yeni constraint ekle
        // Yeni durumlar: 'inceleme_bekliyor', 'dizgi_bekliyor', 'dizgide', 'revize_istendi', 'tamamlandi'
        // Eski durumlar (uyumluluk için): 'beklemede'
        await client.query(`
            ALTER TABLE sorular 
            ADD CONSTRAINT sorular_durum_check 
            CHECK (durum IN ('inceleme_bekliyor', 'dizgi_bekliyor', 'dizgide', 'revize_istendi', 'tamamlandi', 'beklemede', 'arsiv'))
        `);

        // Varsayılan durumu güncelle
        await client.query(`ALTER TABLE sorular ALTER COLUMN durum SET DEFAULT 'inceleme_bekliyor'`);

        await client.query('COMMIT');
        console.log('✅ İş akışı durumları güncellendi (Workflow Status V2)');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Workflow update hatası:', error);
        throw error;
    } finally {
        client.release();
    }
};
