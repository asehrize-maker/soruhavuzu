import pool from '../../config/database.js';

const VALID_STATUSES = [
  'beklemede',
  'inceleme_bekliyor',
  'revize_istendi',
  'revize_gerekli',
  'dizgi_bekliyor',
  'dizgide',
  'inceleme_tamam',
  'tamamlandi',
  'arsiv'
];

export const normalizeSorularDurum = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Geçersiz durumları beklemede'ye çek, bilinen eski değerler için özel mapping
    await client.query(`
      UPDATE sorular
      SET durum = 'inceleme_bekliyor'
      WHERE durum IN ('incelemede', 'inceleme', 'inceleme_tamamlanmadi')
    `);

    await client.query(`
      UPDATE sorular
      SET durum = 'revize_gerekli'
      WHERE durum IN ('revize', 'revize_bekliyor')
    `);

    await client.query(`
      UPDATE sorular
      SET durum = 'beklemede'
      WHERE durum NOT IN (${VALID_STATUSES.map((_, idx) => `$${idx + 1}`).join(',')})
    `, VALID_STATUSES);

    await client.query('COMMIT');
    console.log('Migration 015_normalize_sorular_durum applied');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration 015_normalize_sorular_durum failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

