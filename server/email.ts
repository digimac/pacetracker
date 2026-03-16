import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// The "from" address must be a verified domain in your Resend account.
// Defaults to the Resend shared domain for testing; set RESEND_FROM_EMAIL in env for production.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const APP_URL = process.env.APP_URL || "http://localhost:5000";

export async function sendPasswordResetEmail(toEmail: string, token: string): Promise<void> {
  const resetUrl = `${APP_URL}/#/reset-password?token=${token}`;

  if (!resend) {
    // Dev fallback — log the link so you can test without a real API key
    console.log(`[email] Password reset link (no RESEND_API_KEY set): ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "Reset your Sweet Momentum password",
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f5f5f5; padding: 40px 20px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="display: inline-block; background: #7c3aed; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;">
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
              If the button doesn't work, copy and paste this link into your browser:<br>
              <span style="color: #7c3aed; word-break: break-all;">${resetUrl}</span>
            </p>
          </div>
        </body>
      </html>
    `,
  });
}
