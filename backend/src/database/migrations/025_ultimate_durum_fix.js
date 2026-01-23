import pool from '../../config/database.js';

export const ultimateDurumFix = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🚀 ULTIMATE DURUM FIX: Cleaning all previous constraints...');

        // 1. Find ALL check constraints on 'sorular' table that mention 'durum'
        const constraints = await client.query("SELECT conname FROM pg_constraint INNER JOIN pg_class ON pg_class.oid = pg_constraint.conrelid WHERE pg_class.relname = 'sorular' AND pg_constraint.contype = 'c' AND pg_get_constraintdef(pg_constraint.oid) LIKE '%durum%'");

        for (const row of constraints.rows) {
            console.log('Dropping constraint: ' + row.conname);
            await client.query('ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "' + row.conname + '"');
        }

        // 2. Add the SINGLE source of truth constraint
        await client.query("ALTER TABLE sorular ADD CONSTRAINT sorular_durum_check CHECK (durum IN ('beklemede', 'inceleme_bekliyor', 'incelemede', 'revize_istendi', 'revize_gerekli', 'dizgi_bekliyor', 'dizgide', 'dizgi_tamam', 'inceleme_tamam', 'tamamlandi', 'arsiv'))");

        await client.query('COMMIT');
        console.log('✅ ULTIMATE DURUM FIX applied successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ ULTIMATE DURUM FIX failed:', error);
        throw error;
    } finally {
        client.release();
    }
};
