'use strict';
module.exports = {
  async up(q, S) {
    await q.createTable('refresh_tokens', {
      id: { type: S.BIGINT, autoIncrement: true, primaryKey: true },
      user_id: { type: S.INTEGER, allowNull: false },
      jti: { type: S.STRING(64), allowNull: false, unique: true },
      token_hash: { type: S.STRING(256), allowNull: false },
      revoked: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      expires_at: { type: S.DATE, allowNull: false },
      created_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') },
      updated_at: { type: S.DATE, allowNull: false, defaultValue: S.fn('NOW') }
    });
    await q.addIndex('refresh_tokens', ['user_id'], { name: 'rt_user_id_idx' });
    await q.addIndex('refresh_tokens', ['revoked', 'expires_at'], { name: 'rt_revoked_expires_idx' });
  },
  async down(q) { await q.dropTable('refresh_tokens'); }
};
