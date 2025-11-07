#!/usr/bin/env node

/**
 * Script seguro para crear un usuario administrador
 * 
 * Uso:
 *   node scripts/create-admin.js <email>
 * 
 * Ejemplo:
 *   node scripts/create-admin.js app.miservicio@gmail.com
 * 
 * Este script:
 * 1. Verifica que el usuario existe
 * 2. Actualiza el rol a 'admin'
 * 3. Requiere confirmación explícita
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const { sequelize } = require('../models');
const readline = require('readline');

const ADMIN_EMAIL = 'app.miservicio@gmail.com';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAdmin(email) {
  try {
    console.log('\n🔐 Script de creación de administrador');
    console.log('=====================================\n');

    // Validar email
    if (!email || !email.includes('@')) {
      console.error('❌ Error: Debes proporcionar un email válido');
      console.log('\nUso: node scripts/create-admin.js <email>');
      process.exit(1);
    }

    // Verificar que el email sea el correcto (seguridad adicional)
    if (email !== ADMIN_EMAIL) {
      console.warn(`⚠️  ADVERTENCIA: El email proporcionado (${email}) no coincide con el email de administrador esperado (${ADMIN_EMAIL})`);
      const confirm = await question('¿Deseas continuar de todas formas? (sí/no): ');
      if (confirm.toLowerCase() !== 'sí' && confirm.toLowerCase() !== 'si' && confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
        console.log('❌ Operación cancelada');
        process.exit(0);
      }
    }

    // Conectar a la base de datos
    console.log('📡 Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión exitosa\n');

    // Buscar el usuario
    console.log(`🔍 Buscando usuario con email: ${email}`);
    const results = await sequelize.query(
      `SELECT id, email, role, is_email_verified FROM users WHERE email = :email`,
      {
        replacements: { email },
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!results || results.length === 0) {
      console.error(`❌ Error: No se encontró ningún usuario con el email ${email}`);
      console.log('\n💡 Asegúrate de que el usuario exista antes de convertirlo en administrador.');
      console.log('   Puedes crear el usuario desde la aplicación web primero.\n');
      process.exit(1);
    }

    const user = results[0];
    console.log(`✅ Usuario encontrado:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rol actual: ${user.role}`);
    console.log(`   Email verificado: ${user.is_email_verified ? 'Sí' : 'No'}\n`);

    // Si ya es admin, informar
    if (user.role === 'admin') {
      console.log('ℹ️  Este usuario ya es administrador.');
      process.exit(0);
    }

    // Confirmar acción
    console.log('⚠️  ADVERTENCIA: Esta acción convertirá al usuario en administrador.');
    console.log('   Los administradores tienen acceso a funciones especiales del sistema.\n');
    const confirm = await question('¿Estás seguro de que deseas continuar? (sí/no): ');

    if (confirm.toLowerCase() !== 'sí' && confirm.toLowerCase() !== 'si' && confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ Operación cancelada');
      process.exit(0);
    }

    // Actualizar el rol
    console.log('\n🔄 Actualizando rol a administrador...');
    await sequelize.query(
      `UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = :userId`,
      {
        replacements: { userId: user.id }
      }
    );

    console.log('✅ ¡Usuario actualizado exitosamente!');
    console.log(`\n📋 Resumen:`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nuevo rol: admin`);
    console.log(`\n🔐 El usuario ahora tiene permisos de administrador.`);
    console.log('   Asegúrate de mantener seguras las credenciales de este usuario.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.original) {
      console.error('   Detalles:', error.original.message);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
    rl.close();
  }
}

// Ejecutar
const email = process.argv[2];

if (!email) {
  console.error('❌ Error: Debes proporcionar un email');
  console.log('\nUso: node scripts/create-admin.js <email>');
  console.log(`Ejemplo: node scripts/create-admin.js ${ADMIN_EMAIL}\n`);
  process.exit(1);
}

createAdmin(email);

