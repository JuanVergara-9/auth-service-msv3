'use strict';
module.exports = (sequelize, DataTypes) => {
  const EmailVerificationToken = sequelize.define('EmailVerificationToken', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    token: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, { 
    tableName: 'email_verification_tokens', 
    underscored: true,
    indexes: [
      { unique: true, fields: ['token'] },
      { fields: ['user_id'] }
    ]
  });

  EmailVerificationToken.associate = (models) => {
    EmailVerificationToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  };

  return EmailVerificationToken;
};

