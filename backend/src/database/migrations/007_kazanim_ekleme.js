import pool from '../../config/database.js';

export async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Sorular tablosuna kazanım kolonu ekle
    await client.query(`
      ALTER TABLE sorular 
      ADD COLUMN IF NOT EXISTS kazanim TEXT;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 007: kazanim kolonu eklendi');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 007 hatası:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function down() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE sorular 
      DROP COLUMN IF EXISTS kazanim;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 007 rollback tamamlandı');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
