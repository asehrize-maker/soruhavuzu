const db = require('../../config/database');

module.exports = {
    up: async () => {
        try {
            await db.query(`ALTER TYPE "enum_sorular_durum" ADD VALUE IF NOT EXISTS 'dizgi_tamam' AFTER 'dizgide'`);
            console.log('Migration 020: dizgi_tamam added to enum');
        } catch (error) {
            console.error('Migration 020 error:', error);
        }
    },
    down: async () => {
        // Enum removal is not straightforward in Postgres, usually skipped or requires creating new type
    }
};
