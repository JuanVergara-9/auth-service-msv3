'use strict';
module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    jti: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    token_hash: { type: DataTypes.STRING(256), allowNull: false },
    revoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  }, { tableName: 'refresh_tokens', underscored: true });

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
  };

  return RefreshToken;
};
