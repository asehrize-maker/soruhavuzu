import pool from './backend/src/config/database.js';

async function listConstraints() {
    try {
        const res = await pool.query(`
            SELECT conname, pg_get_constraintdef(oid) as def
            FROM pg_constraint 
            WHERE conrelid = 'sorular'::regclass
        `);
        console.log('--- CONSTRAINTS ON "sorular" ---');
        console.table(res.rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
listConstraints();
