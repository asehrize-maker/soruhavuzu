import pool from '../../config/database.js';

export const workflowV2Statuses = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('🚀 WORKFLOW V2 STATUSES: Updating constraints for specific alan/dil stages...');

        // Dropping old constraint
        const query = "SELECT conname FROM pg_constraint JOIN pg_attribute ON pg_attribute.attrelid = pg_constraint.conrelid AND pg_attribute.attnum = ANY(pg_constraint.conkey) WHERE pg_constraint.contype = 'c' AND pg_constraint.conrelid = 'sorular'::regclass AND pg_attribute.attname = 'durum'";
        const constraints = await client.query(query);

        for (const row of constraints.rows) {
            await client.query('ALTER TABLE sorular DROP CONSTRAINT IF EXISTS "' + row.conname + '"');
        }

        // New statuses
        const statuses = [
            'beklemede',
            'dizgi_bekliyor',
            'dizgide',
            'dizgi_tamam',
            'alan_incelemede', // New
            'alan_onaylandi',  // New (Back to Branch)
            'dil_incelemede',  // New
            'dil_onaylandi',   // New (Back to Branch)
            'revize_istendi',
            'revize_gerekli',
            'inceleme_bekliyor', // Legacy support
            'incelemede',        // Legacy support
            'inceleme_tamam',    // Legacy support (might be used for final check before tamamlandi)
            'tamamlandi',        // Common Pool
            'arsiv'
        ];

        await client.query("ALTER TABLE sorular ADD CONSTRAINT sorular_durum_check CHECK (durum IN ('" + statuses.join("','") + "'))");

        await client.query('COMMIT');
        console.log('✅ WORKFLOW V2 STATUSES applied successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ WORKFLOW V2 STATUSES failed:', error);
        throw error;
    } finally {
        client.release();
    }
};
