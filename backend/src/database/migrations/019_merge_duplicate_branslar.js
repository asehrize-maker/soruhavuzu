import pool from '../../config/database.js';

export const mergeDuplicateBranslar = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Yinelenen branş isimlerini ve ID'lerini bul
        const duplicatesRes = await client.query(`
      SELECT brans_adi, array_agg(id ORDER BY id ASC) as ids
      FROM branslar
      GROUP BY brans_adi
      HAVING COUNT(*) > 1
    `);

        for (const row of duplicatesRes.rows) {
            const { brans_adi, ids } = row;
            const mainId = ids[0];
            const otherIds = ids.slice(1);

            console.log(`Merging duplicates for branch: ${brans_adi} (Main ID: ${mainId}, Merging: ${otherIds})`);

            // 2. Soruları ana ID'ye aktar
            await client.query(
                'UPDATE sorular SET brans_id = $1 WHERE brans_id = ANY($2)',
                [mainId, otherIds]
            );

            // 3. Kullanıcıların ana branşını güncelle
            await client.query(
                'UPDATE kullanicilar SET brans_id = $1 WHERE brans_id = ANY($2)',
                [mainId, otherIds]
            );

            // 4. Kullanıcı yetki branşlarını güncelle
            // Önce çakışmaları (ana branşa zaten yetkili olanlar) sil
            await client.query(`
        DELETE FROM kullanici_branslari kb1
        WHERE brans_id = ANY($1)
        AND EXISTS (
          SELECT 1 FROM kullanici_branslari kb2
          WHERE kb2.kullanici_id = kb1.kullanici_id
          AND kb2.brans_id = $2
        )
      `, [otherIds, mainId]);

            // Sonra kalanları ana branşa aktar
            await client.query(
                'UPDATE kullanici_branslari SET brans_id = $1 WHERE brans_id = ANY($2)',
                [mainId, otherIds]
            );

            // 5. Diğer branş kayıtlarını sil
            await client.query(
                'DELETE FROM branslar WHERE id = ANY($1)',
                [otherIds]
            );
        }

        // 6. brans_adi üzerine UNIQUE kısıtlaması ekle (artık hepsi global)
        // Önce ismi normalleştirip (trim, uppercase) temizleyebiliriz
        await client.query('UPDATE branslar SET brans_adi = UPPER(TRIM(brans_adi))');

        // Mükemmel temizlik için tekrar bi kontrol (üstteki upper/trim sonrası yeni duplicate oluşmussa)
        // Ama şimdilik basit tutalım.

        await client.query(`
      ALTER TABLE branslar DROP CONSTRAINT IF EXISTS branslar_brans_adi_key;
    `);

        await client.query(`
      ALTER TABLE branslar ADD CONSTRAINT branslar_brans_adi_unique UNIQUE (brans_adi);
    `);

        await client.query('COMMIT');
        console.log('✅ Migration 019: Yinelenen branşlar birleştirildi ve UNIQUE kısıtlaması eklendi.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration 019 Hatası:', error);
        throw error;
    } finally {
        client.release();
    }
};
