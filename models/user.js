'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(120), allowNull: false },
    role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'user' },
    is_email_verified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { tableName: 'users', underscored: true });

  User.associate = (models) => {
    User.hasMany(models.RefreshToken, { as: 'refreshTokens', foreignKey: 'user_id' });
  };

  return User;
};
