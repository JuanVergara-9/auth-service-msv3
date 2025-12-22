const { Resend } = require('resend');
const dns = require('dns').promises;

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'MiServicio <soporte@miservicio.ar>';

/**
 * Envia un email de verificación usando Resend
 * @param {string} email 
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
async function sendVerificationEmail(email, token) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Verifica tu cuenta - MiServicio',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>¡Bienvenido a MiServicio!</h2>
          <p>Para completar tu registro y verificar tu identidad, haz clic en el siguiente enlace:</p>
          <p style="margin: 30px 0;">
            <a href="https://miservicio.ar/verify?token=${token}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               Verificar mi correo
            </a>
          </p>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p>https://miservicio.ar/verify?token=${token}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Si no solicitaste este correo, puedes ignorarlo con seguridad.</p>
        </div>
      `
    });

    if (error) {
      console.error('[EmailService.sendVerificationEmail] Error de Resend:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[EmailService.sendVerificationEmail] Fallo crítico:', error);
    return false;
  }
}

/**
 * Envia un email para restablecer la contraseña usando Resend
 * @param {string} email 
 * @param {string} token 
 * @returns {Promise<boolean>}
 */
async function sendPasswordResetEmail(email, token) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Restablecer contraseña - MiServicio',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Restablecer tu contraseña</h2>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo para continuar:</p>
          <p style="margin: 30px 0;">
            <a href="https://miservicio.ar/reset-password?token=${token}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
               Restablecer contraseña
            </a>
          </p>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p>https://miservicio.ar/reset-password?token=${token}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Si no solicitaste este cambio, puedes ignorar este correo; tu contraseña permanecerá igual.</p>
        </div>
      `
    });

    if (error) {
      console.error('[EmailService.sendPasswordResetEmail] Error de Resend:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[EmailService.sendPasswordResetEmail] Fallo crítico:', error);
    return false;
  }
}

/**
 * Verifica que un dominio de email existe (mantenido para compatibilidad con el sistema actual)
 */
async function verifyEmailDomain(email) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    
    try {
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (mxError) {
      try {
        await dns.resolve4(domain);
        return true;
      } catch {
        return false;
      }
    }
  } catch (error) {
    console.error('[EmailService.verifyEmailDomain] Error:', error.message);
    return false; 
  }
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyEmailDomain
};
