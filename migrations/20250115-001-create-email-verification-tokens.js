'use strict';
module.exports = {
  async up(q, S) {
    await q.createTable('email_verification_tokens', {
      id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { 
        type: S.INTEGER, 
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      token: { type: S.STRING(255), allowNull: false, unique: true },
      expires_at: { type: S.DATE, allowNull: false },
      used: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') }
    });
    await q.addIndex('email_verification_tokens', ['token'], { unique: true, name: 'evt_token_uq' });
    await q.addIndex('email_verification_tokens', ['user_id'], { name: 'evt_user_id_idx' });
  },
  async down(q) { await q.dropTable('email_verification_tokens'); }
};

