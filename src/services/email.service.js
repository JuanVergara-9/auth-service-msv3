const nodemailer = require('nodemailer');
const dns = require('dns').promises;

// Verificar que un dominio de email existe (verifica DNS MX)
async function verifyEmailDomain(email) {
  try {
    const domain = email.split('@')[1];
    if (!domain) return false;
    
    // Verificar que el dominio tiene registros MX o A
    try {
      const mxRecords = await dns.resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (mxError) {
      // Si no hay MX, verificar que al menos tiene registro A
      try {
        await dns.resolve4(domain);
        return true;
      } catch {
        return false;
      }
    }
  } catch (error) {
    console.error('[verifyEmailDomain] Error:', error.message);
    return false; // En caso de error, permitir el registro (no bloquear)
  }
}

// Crear transporter de nodemailer
function createTransporter() {
  // En desarrollo, usar ethereal.email o consola
  if (process.env.NODE_ENV !== 'production' || !process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER || 'ethereal.user@ethereal.email',
        pass: process.env.ETHEREAL_PASS || 'ethereal.pass'
      }
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// Enviar email de verificación
async function sendVerificationEmail(email, token, userName = null) {
  const transporter = createTransporter();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const verificationUrl = `${frontendUrl}/auth/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || `"miservicio" <noreply@miservicio.com>`,
    to: email,
    subject: 'Verifica tu correo electrónico - miservicio',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica tu correo</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header con logo -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #2F66F5 0%, #2563EB 100%); border-radius: 12px 12px 0 0;">
                    <div style="width: 64px; height: 64px; margin: 0 auto 20px; background-color: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
                        <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">miservicio</h1>
                  </td>
                </tr>
                <!-- Contenido -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px; color: #111827; font-size: 24px; font-weight: 600;">
                      ${userName ? `¡Hola ${userName}!` : '¡Bienvenido!'}
                    </h2>
                    <p style="margin: 0 0 24px; color: #6B7280; font-size: 16px; line-height: 1.6;">
                      Gracias por registrarte en miservicio. Para completar tu registro, por favor verifica tu dirección de correo electrónico haciendo clic en el botón de abajo.
                    </p>
                    <!-- Botón de verificación -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 32px 0;">
                      <tr>
                        <td align="center">
                          <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #2563EB; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                            Verificar mi correo
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0; color: #9CA3AF; font-size: 14px; line-height: 1.5;">
                      Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                      <a href="${verificationUrl}" style="color: #2563EB; word-break: break-all;">${verificationUrl}</a>
                    </p>
                    <p style="margin: 32px 0 0; color: #9CA3AF; font-size: 12px; line-height: 1.5;">
                      Este enlace expirará en 24 horas. Si no solicitaste este correo, puedes ignorarlo.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 40px; background-color: #F9FAFB; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; color: #6B7280; font-size: 14px;">
                      © ${new Date().getFullYear()} miservicio. Todos los derechos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Verifica tu correo electrónico\n\nHaz clic en el siguiente enlace para verificar tu cuenta:\n${verificationUrl}\n\nEste enlace expirará en 24 horas.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[sendVerificationEmail] Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[sendVerificationEmail] Error:', error.message);
    throw error;
  }
}

module.exports = {
  sendVerificationEmail,
  verifyEmailDomain
};

