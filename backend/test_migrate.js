import createTables from './src/database/migrate.js';

createTables()
    .then(() => {
        console.log('✅ Migration successful');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    });
