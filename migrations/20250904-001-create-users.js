'use strict';
module.exports = {
  async up(q, S) {
    await q.createTable('users', {
      id: { type: S.INTEGER, autoIncrement: true, primaryKey: true },
      email: { type: S.STRING(160), allowNull: false, unique: true },
      password_hash: { type: S.STRING(120), allowNull: false },
      role: { type: S.STRING(20), allowNull: false, defaultValue: 'user' }, // user|provider|admin
      is_email_verified: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') }
    });
    await q.addIndex('users', ['email'], { unique: true, name: 'users_email_uq' });
  },
  async down(q) { await q.dropTable('users'); }
};
