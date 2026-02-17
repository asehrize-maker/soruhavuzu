import pool from './src/config/database.js';

async function checkCols() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sorular'");
        console.log('--- COLUMNS IN sorular ---');
        res.rows.forEach(row => console.log(`${row.column_name}: ${row.data_type}`));
        process.exit(0);
    } catch (err) {
        console.error('Check failed:', err);
        process.exit(1);
    }
}

checkCols();
