const pkg = require('../../package.json');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('aktivite_loglari', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            kullanici_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'kullanicilar',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            soru_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'sorular',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            islem_turu: {
                type: Sequelize.STRING(50),
                allowNull: false
            },
            aciklama: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            detay: {
                type: Sequelize.JSONB, // PostgreSQL specific, stores extra data like branch_name, team_name at that time
                allowNull: true
            },
            tarih: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Performance index
        await queryInterface.addIndex('aktivite_loglari', ['tarih']);
        await queryInterface.addIndex('aktivite_loglari', ['kullanici_id']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('aktivite_loglari');
    }
};
