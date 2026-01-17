import pool from '../../config/database.js';

export const seedSivasEkibi = async () => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('🌱 Sivas Ekibi seed işlemi başlıyor...');

        // 1. Sivas Ekibi'ni oluştur veya mevcut olanı bul
        let ekipId;
        const checkEkip = await client.query("SELECT id FROM ekipler WHERE ekip_adi = 'Sivas Ekibi'");

        if (checkEkip.rows.length > 0) {
            ekipId = checkEkip.rows[0].id;
            console.log(`ℹ️ Sivas Ekibi zaten mevcut (ID: ${ekipId})`);
        } else {
            const insertEkip = await client.query(
                "INSERT INTO ekipler (ekip_adi, aciklama) VALUES ($1, $2) RETURNING id",
                ['Sivas Ekibi', 'Soru Havuzu Yönetim Ekibi']
            );
            ekipId = insertEkip.rows[0].id;
            console.log(`✅ Sivas Ekibi oluşturuldu (ID: ${ekipId})`);
        }

        // 2. 5 Temel Branşı bu ekibe ekle
        const branslar = [
            'TÜRKÇE',
            'FEN BİLİMLERİ',
            'SOSYAL BİLGİLER',
            'MATEMATİK',
            'İNGİLİZCE'
        ];

        for (const bransAdi of branslar) {
            // Check if branch exists for this team
            const checkBrans = await client.query(
                "SELECT id FROM branslar WHERE brans_adi = $1 AND ekip_id = $2",
                [bransAdi, ekipId]
            );

            if (checkBrans.rows.length === 0) {
                await client.query(
                    "INSERT INTO branslar (brans_adi, ekip_id, aciklama) VALUES ($1, $2, $3)",
                    [bransAdi, ekipId, `${bransAdi} Branşı`]
                );
                console.log(`✅ ${bransAdi} branşı eklendi.`);
            } else {
                console.log(`ℹ️ ${bransAdi} branşı zaten mevcut.`);
            }
        }

        await client.query('COMMIT');
        console.log('✅ Sivas Ekibi seed işlemi tamamlandı.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Sivas Ekibi seed hatası:', error);
        throw error;
    } finally {
        client.release();
    }
};
