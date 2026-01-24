import pool from '../../config/database.js';

// Güncel ve genişletilmiş durum listesi (workflow v2 + dizgi_tamam)
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

export const updateWorkflowStatus = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Eski constraint'i temizle
    await client.query('ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check');

    // Genişletilmiş liste ile constraint ekle
    const quoted = DURUM_LISTESI.map(s => `'${s}'`).join(',');
    await client.query(`
      ALTER TABLE sorular
      ADD CONSTRAINT sorular_durum_check
      CHECK (TRIM(LOWER(durum)) IN (${quoted}))
    `);

    // Varsayılan durum
    await client.query(`ALTER TABLE sorular ALTER COLUMN durum SET DEFAULT 'beklemede'`);

    await client.query('COMMIT');
    console.log('✅ İş akışı durumları güncellendi (V2, genişletilmiş liste)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Workflow update hatası:', error);
    throw error;
  } finally {
    client.release();
  }
};
