import pool from './backend/src/config/database.js';
async function f() {
    try {
        const res = await pool.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name IN ('kullanicilar', 'kullanici_branslari', 'sorular') 
      AND column_name IN ('id', 'kullanici_id', 'brans_id', 'olusturan_kullanici_id')
    `);
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
f();
