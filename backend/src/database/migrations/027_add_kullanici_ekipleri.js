const pkg = require('../../package.json');
const path = require('path');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // 1. Tabloyu oluştur: kullanici_ekipleri
        // (Eğer varsa hata vermesin diye IF NOT EXISTS otomatik olarak eklenemiyor raw query olmadığı sürece ama 
        // sequelize migration'ı tablonun yokluğunu varsayar.)

        await queryInterface.createTable('kullanici_ekipleri', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            kullanici_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'kullanicilar',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            ekip_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'ekipler',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            olusturulma_tarihi: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // 2. Unique index ekle (aynı kullanıcı aynı ekibe iki kez eklenemesin)
        await queryInterface.addIndex('kullanici_ekipleri', ['kullanici_id', 'ekip_id'], {
            unique: true,
            name: 'unique_kullanici_ekip'
        });

        // 3. Mevcut 'ekip_id' kolonundaki verileri bu tabloya taşı
        // Bu işlem için raw query kullanacağız
        await queryInterface.sequelize.query(`
      INSERT INTO kullanici_ekipleri (kullanici_id, ekip_id)
      SELECT id, ekip_id FROM kullanicilar WHERE ekip_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

        // Not: kullanicilar.ekip_id kolonunu silmiyoruz, backward compatibility için
        // veya "Ana Ekip" olarak tutabiliriz. Ancak yeni mantıkta team isolation
        // bu yeni tablo üzerinden yapılacaksa, oradaki veriyi sync etmek gerekecek.
        // Şimdilik sadece multi-team desteği için tabloyu açıyoruz.
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('kullanici_ekipleri');
    }
};
