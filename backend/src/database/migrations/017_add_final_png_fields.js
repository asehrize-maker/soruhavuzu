import pool from '../../config/database.js';

export const addFinalPngFields = async () => {
    const client = await pool.connect();
    try {
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sorular' AND column_name = 'final_png_url'
    `);

        if (res.rows.length === 0) {
            console.log('Adding final_png_url and final_png_public_id to sorular table...');
            await client.query(`
        ALTER TABLE sorular 
        ADD COLUMN final_png_url VARCHAR(500),
        ADD COLUMN final_png_public_id VARCHAR(255)
      `);
            console.log('Successfully added final_png fields.');
        } else {
            console.log('final_png fields already exist.');
        }
    } catch (error) {
        console.error('Error adding final_png fields:', error);
        throw error;
    } finally {
        client.release();
    }
};
