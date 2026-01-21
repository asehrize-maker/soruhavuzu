import pool from './src/config/database.js';
async function run() {
    try {
        const res = await pool.query('SELECT durum, COUNT(*) FROM sorular GROUP BY durum');
        console.log('--- DURUM ÖZETİ ---');
        console.table(res.rows);

        const unassigned = await pool.query('SELECT COUNT(*) FROM sorular WHERE brans_id IS NULL');
        console.log('Branşsız Soru Sayısı:', unassigned.rows[0].count);

        const inceleme = await pool.query(`
      SELECT s.id, s.durum, s.onay_alanci, s.onay_dilci, b.brans_adi
      FROM sorular s
      LEFT JOIN branslar b ON s.brans_id = b.id
      WHERE s.durum IN ('inceleme_bekliyor', 'incelemede', 'revize_istendi')
      LIMIT 10
    `);
        console.log('--- İNCELEME ÖRNEKLERİ ---');
        console.table(inceleme.rows);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
