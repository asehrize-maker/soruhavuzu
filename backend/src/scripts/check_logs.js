import pool from '../config/database.js';

const checkTable = async () => {
    try {
        const res = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'aktivite_loglari'
      );
    `);
        console.log('Table aktivite_loglari exists:', res.rows[0].exists);

        if (res.rows[0].exists) {
            const countRes = await pool.query('SELECT COUNT(*) FROM aktivite_loglari');
            console.log('Activity log count:', countRes.rows[0].count);

            const sample = await pool.query('SELECT * FROM aktivite_loglari LIMIT 5');
            console.log('Sample logs:', sample.rows);
        }
    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit();
    }
};

checkTable();
