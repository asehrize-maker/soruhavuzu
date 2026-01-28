export const addGorevTipiToDenemeler = async (client) => {
    try {
        // Check if column exists first
        const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='deneme_takvimi' AND column_name='gorev_tipi'
    `);

        if (checkColumn.rowCount === 0) {
            await client.query(`
        ALTER TABLE deneme_takvimi 
        ADD COLUMN gorev_tipi VARCHAR(50) DEFAULT 'deneme'
      `);
            console.log('Migration 033: gorev_tipi column added to deneme_takvimi');
        }
    } catch (err) {
        console.error('Migration 033 failed:', err);
        throw err;
    }
};
