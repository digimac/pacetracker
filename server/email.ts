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

export async function sendFeedbackEmail(opts: {
  fromDisplayName: string;
  fromEmail: string;
  feedbackType: string;
  summary: string;
  urgency: string;
}): Promise<void> {
  const { fromDisplayName, fromEmail, feedbackType, summary, urgency } = opts;
  const transporter = createTransporter();
  const to = "track@sweetmo.io";

  const urgencyColor: Record<string, string> = {
    "Fun Idea":       "#4ade80",
    "Nice to Have":   "#60a5fa",
    "Urgent Fix Needed": "#f87171",
  };
  const accentColor = urgencyColor[urgency] || "#a78bfa";

  if (!transporter) {
    console.log(`[email] SMTP not configured. Feedback from ${fromEmail}: [${urgency}] ${feedbackType} — ${summary}`);
    return;
  }

  const fromAddress = SMTP_FROM_EMAIL
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
    : `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  try {
  await transporter.sendMail({
    from: fromAddress,
    to,
    replyTo: fromEmail,
    subject: `[Feedback] ${urgency} — ${feedbackType}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #f5f5f5; padding: 40px 20px; margin: 0;">
          <div style="max-width: 540px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 28px;">
              <div style="display: inline-block; background: #7c3aed; border-radius: 12px; padding: 10px 18px; margin-bottom: 14px;">
                <span style="color: white; font-weight: 900; font-size: 13px; letter-spacing: 0.1em;">SWEET MOMENTUM</span>
              </div>
              <h1 style="font-size: 20px; font-weight: 900; margin: 0; color: #f5f5f5;">New Feedback Received</h1>
            </div>

            <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; padding: 28px; margin-bottom: 20px;">

              <!-- Urgency badge -->
              <div style="margin-bottom: 20px;">
                <span style="display: inline-block; background: ${accentColor}22; color: ${accentColor}; border: 1px solid ${accentColor}44; border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
                  ${urgency}
                </span>
              </div>

              <!-- Feedback type -->
              <div style="margin-bottom: 18px;">
                <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.08em;">Feedback Type</p>
                <p style="margin: 0; font-size: 15px; color: #f5f5f5; font-weight: 600;">${feedbackType}</p>
              </div>

              <!-- Summary -->
              <div style="margin-bottom: 18px;">
                <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.08em;">Summary</p>
                <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 14px;">
                  <p style="margin: 0; font-size: 14px; color: #e0e0e0; line-height: 1.6; white-space: pre-wrap;">${summary}</p>
                </div>
              </div>

              <!-- From -->
              <div style="border-top: 1px solid #2a2a2a; padding-top: 16px;">
                <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: 0.08em;">From</p>
                <p style="margin: 0; font-size: 14px; color: #a0a0a0;">${fromDisplayName} &lt;<a href="mailto:${fromEmail}" style="color: #7c3aed; text-decoration: none;">${fromEmail}</a>&gt;</p>
              </div>
            </div>

            <p style="color: #444; font-size: 12px; text-align: center; margin: 0;">
              Reply directly to this email to respond to ${fromDisplayName}.
            </p>
          </div>
        </body>
      </html>
    `,
    text: `New Feedback — ${urgency}\n\nType: ${feedbackType}\n\nSummary:\n${summary}\n\nFrom: ${fromDisplayName} <${fromEmail}>`,
  });

  console.log(`[email] Feedback email sent to ${to} from ${fromEmail}`);
  } catch (smtpErr: any) {
    console.error(`[email] SMTP error sending feedback from ${fromEmail}:`, smtpErr?.message || smtpErr);
    // Don't rethrow — submission still succeeds from the user's perspective
  }
}

// ── Send accountability partner invite ──────────────────────────────────────
export async function sendInviteEmail(opts: {
  senderName: string;
  senderEmail: string;
  inviteeEmail: string;
  message?: string;
  inviteUrl: string;
}): Promise<void> {
  const { senderName, senderEmail, inviteeEmail, message, inviteUrl } = opts;

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email] SMTP not configured. Invite from ${senderEmail} to ${inviteeEmail}: ${inviteUrl}`);
    return;
  }

  const fromAddress = SMTP_FROM_EMAIL
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
    : `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: inviteeEmail,
      replyTo: senderEmail,
      subject: `${senderName} invited you to Sweet Momentum`,
      html: `
        <body style="margin:0;padding:0;background:#0f0f0f;font-family:sans-serif;">
          <div style="max-width:540px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
            <div style="background:#FF6E00;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:1px;">Sweet Momentum</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Daily Performance Tracking</p>
            </div>
            <div style="padding:32px;">
              <p style="color:#e0e0e0;font-size:16px;margin:0 0 16px;">Hey there,</p>
              <p style="color:#e0e0e0;font-size:15px;margin:0 0 24px;">
                <strong style="color:#fff;">${senderName}</strong> has invited you to connect on Sweet Momentum as their accountability partner.
              </p>
              ${message ? `
              <div style="background:#252525;border-left:3px solid #FF6E00;border-radius:4px;padding:16px;margin:0 0 24px;">
                <p style="margin:0;color:#ccc;font-size:14px;font-style:italic;">"${message}"</p>
                <p style="margin:8px 0 0;color:#888;font-size:12px;">— ${senderName}</p>
              </div>
              ` : ""}
              <p style="color:#bbb;font-size:14px;margin:0 0 24px;">
                Once you join, ${senderName} will be able to see your daily score — just the score, nothing else. You'll also see theirs. It's a simple way to stay accountable.
              </p>
              <div style="text-align:center;margin:32px 0;">
                <a href="${inviteUrl}" style="display:inline-block;background:#FF6E00;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;letter-spacing:0.5px;">
                  Accept Invite &amp; Join Free
                </a>
              </div>
              <p style="color:#666;font-size:12px;text-align:center;margin:0;">
                This invite expires in 7 days. If you didn't expect this, you can safely ignore it.
              </p>
            </div>
          </div>
        </body>
      `,
      text: `${senderName} invited you to join Sweet Momentum as their accountability partner.\n\n${message ? `"${message}"\n\n` : ""}Accept the invite and create your free account:\n${inviteUrl}\n\nThis link expires in 7 days.`,
    });
    console.log(`[email] Invite sent from ${senderEmail} to ${inviteeEmail}`);
  } catch (smtpErr: any) {
    console.error(`[email] SMTP error sending invite to ${inviteeEmail}:`, smtpErr?.message || smtpErr);
  }
}
