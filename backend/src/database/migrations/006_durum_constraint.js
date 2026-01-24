import pool from '../../config/database.js';

// Tek ve güncel durum listesi (workflow v2 + dizgi_tamam)
const DURUM_LISTESI = [
  'beklemede',
  'dizgi_bekliyor',
  'dizgide',
  'dizgi_tamam',
  'alan_incelemede',
  'alan_onaylandi',
  'dil_incelemede',
  'dil_onaylandi',
  'revize_istendi',
  'revize_gerekli',
  'inceleme_bekliyor',
  'incelemede',
  'inceleme_tamam',
  'tamamlandi',
  'arsiv'
];

export const updateDurumConstraint = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Eski constraint'i kaldır
    await client.query(`ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check`);

    // Yeni, genişletilmiş liste ile constraint ekle
    const quoted = DURUM_LISTESI.map(s => `'${s}'`).join(',');
    await client.query(`
      ALTER TABLE sorular 
      ADD CONSTRAINT sorular_durum_check 
      CHECK (TRIM(LOWER(durum)) IN (${quoted}))
    `);

    await client.query('COMMIT');
    console.log('✅ Durum constraint güncellendi (genişletilmiş durum listesi)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Durum constraint güncelleme hatası:', error);
    throw error;
  } finally {
    client.release();
  }
};
