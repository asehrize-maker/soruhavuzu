import pool from '../backend/src/config/database.js';

async function reindex() {
    const client = await pool.connect();
    try {
        console.log('--- REINDEXING QUESTION IDS ---');
        await client.query('BEGIN');

        // 1. Get current questions and their new IDs
        const { rows: mapping } = await client.query('SELECT id as old_id, row_number() OVER (ORDER BY id) as new_id FROM sorular');
        console.log(`Found ${mapping.length} questions to reindex.`);

        if (mapping.length === 0) {
            console.log('No questions found. Resetting sequence to 0.');
            await client.query("SELECT setval('sorular_id_seq', 1, false)");
            await client.query('COMMIT');
            return;
        }

        // Creating a mapping table for faster updates
        await client.query('CREATE TEMP TABLE id_mapping (old_id INTEGER, new_id INTEGER)');
        for (const m of mapping) {
            await client.query('INSERT INTO id_mapping VALUES ($1, $2)', [m.old_id, m.new_id]);
        }

        // 2. Update related tables
        const relatedTables = [
            { name: 'mesajlar', col: 'soru_id' },
            { name: 'soru_goruntulenme', col: 'soru_id' },
            { name: 'dizgi_gecmisi', col: 'soru_id' },
            { name: 'soru_versiyonlari', col: 'soru_id' },
            { name: 'soru_yorumlari', col: 'soru_id' },
            { name: 'soru_revize_notlari', col: 'soru_id' },
            { name: 'aktivite_loglari', col: 'soru_id' }
        ];

        for (const t of relatedTables) {
            const { rowCount } = await client.query(`UPDATE ${t.name} tbl SET ${t.col} = m.new_id FROM id_mapping m WHERE tbl.${t.col} = m.old_id`);
            console.log(`Updated ${rowCount} rows in ${t.name}`);
        }

        // 3. Update main table
        // Use negative IDs temporarily to avoid collisions during update
        await client.query('UPDATE sorular s SET id = -m.new_id FROM id_mapping m WHERE s.id = m.old_id');
        await client.query('UPDATE sorular SET id = -id');
        console.log('Updated question IDs in principal table.');

        // 4. Reset sequence
        const { rows: maxIdRow } = await client.query('SELECT MAX(id) as max_id FROM sorular');
        const maxId = maxIdRow[0].max_id || 0;
        await client.query(`SELECT setval('sorular_id_seq', ${maxId}, ${maxId > 0})`);
        console.log(`Sequence reset to ${maxId}.`);

        await client.query('COMMIT');
        console.log('--- SUCCESS: REINDEXING COMPLETE ---');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('--- ERROR: REINDEXING FAILED ---', err);
    } finally {
        client.release();
        process.exit();
    }
}

reindex();
