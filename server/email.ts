import nodemailer from "nodemailer";

// SMTP.com relay credentials — set these in Render environment variables:
//   SMTP_HOST        e.g. send.smtp.com
//   SMTP_PORT        e.g. 587
//   SMTP_USER        your SMTP.com username / sender name
//   SMTP_PASS        your SMTP.com API key or password
//   SMTP_FROM_EMAIL  the verified "from" address, e.g. noreply@yourdomain.com
//   SMTP_FROM_NAME   display name, e.g. Sweet Momentum

const SMTP_HOST      = process.env.SMTP_HOST      || "send.smtp.com";
const SMTP_PORT      = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER      = process.env.SMTP_USER      || "";
const SMTP_PASS      = process.env.SMTP_PASS      || "";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "";
const SMTP_FROM_NAME  = process.env.SMTP_FROM_NAME  || "Sweet Momentum";
const APP_URL        = process.env.APP_URL         || "http://localhost:5000";

function createTransporter() {
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,   // true for port 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(toEmail: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/#/reset-password?token=${token}`;
  const transporter = createTransporter();

  if (!transporter) {
    // Dev fallback — log the link when SMTP credentials aren't configured
    console.log(`[email] SMTP not configured. Password reset link: ${resetUrl}`);
    return;
  }

  const fromAddress = SMTP_FROM_EMAIL
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
    : `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: "Reset your Sweet Momentum password",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f5f5f5; padding: 40px 20px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #7c3aed; border-radius: 12px; padding: 12px 20px; margin-bottom: 16px;">
                <span style="color: white; font-weight: 900; font-size: 14px; letter-spacing: 0.1em;">SWEET MOMENTUM</span>
              </div>
              <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #f5f5f5;">Reset your password</h1>
            </div>

            <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
              <p style="margin: 0 0 24px; color: #a0a0a0; font-size: 15px; line-height: 1.6;">
                We received a request to reset the password for your account. Click the button below to choose a new password.
              </p>
              <div style="text-align: center;">
                <a href="${resetUrl}" style="display: inline-block; background: #7c3aed; color: white; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 8px; letter-spacing: 0.02em;">
                  Reset Password
                </a>
              </div>
              <p style="margin: 24px 0 0; color: #666; font-size: 13px; text-align: center;">
                This link expires in <strong style="color: #a0a0a0;">1 hour</strong>. If you didn't request this, you can safely ignore this email.
              </p>
            </div>

            <p style="color: #444; font-size: 12px; text-align: center; margin: 0;">
              If the button doesn't work, copy and paste this link:<br>
              <span style="color: #7c3aed; word-break: break-all;">${resetUrl}</span>
            </p>
          </div>
        </body>
      </html>
    `,
    text: `Reset your Sweet Momentum password\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  });

  console.log(`[email] Password reset email sent to ${toEmail}`);
}
