import pool from '../../config/database.js';

export const updateWorkflowStatus = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Eski constraint'i temizle
    await client.query('ALTER TABLE sorular DROP CONSTRAINT IF EXISTS sorular_durum_check');

    // Yeni durum seti ile constraint'i ekle
    await client.query(`
      ALTER TABLE sorular
      ADD CONSTRAINT sorular_durum_check
      CHECK (
        durum IN (
          'beklemede',
          'inceleme_bekliyor',
          'revize_istendi',
          'revize_gerekli',
          'dizgi_bekliyor',
          'dizgide',
          'inceleme_tamam',
          'tamamlandi',
          'arsiv'
        )
      )
    `);

    // Varsayılan durum
    await client.query(`ALTER TABLE sorular ALTER COLUMN durum SET DEFAULT 'beklemede'`);

    await client.query('COMMIT');
    console.log('✅ İş akışı durumları güncellendi (V2)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Workflow update hatası:', error);
    throw error;
  } finally {
    client.release();
  }
};

