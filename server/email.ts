import nodemailer from "nodemailer";
import { storage } from "./storage";

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
    secure: SMTP_PORT === 465,   // true for port 465 (SSL), false for 587/2525 (STARTTLS)
    auth: {
      type: "LOGIN" as const,   // SMTP.com channel password auth requires LOGIN method
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,  // prevent cert issues on shared SMTP hosts
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

// ── Send momentum partner invite ──────────────────────────────────────
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

  // ── Default hardcoded template (used if no DB override exists) ──
  const defaultSubject = `${senderName} invited you to Sweet Momentum`;
  const defaultHtml = `
        <body style="margin:0;padding:0;background:#0f0f0f;font-family:sans-serif;">
          <div style="max-width:540px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
            <div style="background:#FF6E00;padding:32px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:1px;">Sweet Momentum</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Daily Performance Tracking</p>
            </div>
            <div style="padding:32px;">
              <p style="color:#e0e0e0;font-size:16px;margin:0 0 16px;">Hey there,</p>
              <p style="color:#e0e0e0;font-size:15px;margin:0 0 24px;">
                <strong style="color:#fff;">${senderName}</strong> has invited you to connect on Sweet Momentum as their momentum partner.
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
      `;
  const defaultText = `${senderName} invited you to join Sweet Momentum as their momentum partner.\n\n${message ? `"${message}"\n\n` : ""}Accept the invite and create your free account:\n${inviteUrl}\n\nThis link expires in 7 days.`;

  // ── Try to load admin-configured DB template, fall back to defaults ──
  let subject = defaultSubject;
  let html    = defaultHtml;
  let text    = defaultText;

  try {
    const tpl = await storage.getEmailTemplate("invite");
    if (tpl) {
      // Replace template variables: {{senderName}}, {{inviteUrl}}, {{message}}
      const interpolate = (s: string) => s
        .replace(/\{\{senderName\}\}/g, senderName)
        .replace(/\{\{inviteUrl\}\}/g, inviteUrl)
        .replace(/\{\{message\}\}/g, message || "");
      subject = interpolate(tpl.subject);
      html    = interpolate(tpl.bodyHtml);
      text    = interpolate(tpl.bodyText);
    }
  } catch (dbErr) {
    console.warn("[email] Could not load invite template from DB, using default:", dbErr);
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: inviteeEmail,
      replyTo: senderEmail,
      subject,
      html,
      text,
    });
    console.log(`[email] Invite sent from ${senderEmail} to ${inviteeEmail}`);
  } catch (smtpErr: any) {
    console.error(`[email] SMTP error sending invite to ${inviteeEmail}:`, smtpErr?.message || smtpErr);
  }
}

// ── Send Pro upgrade notification ────────────────────────────────────────────
export async function sendUpgradeEmail(opts: {
  toEmail: string;
  displayName: string;
}): Promise<void> {
  const { toEmail, displayName } = opts;

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email] SMTP not configured. Upgrade email for ${toEmail} skipped.`);
    return;
  }

  const fromAddress = SMTP_FROM_EMAIL
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
    : `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  // ── Default template ──
  const defaultSubject = `You've been upgraded to Sweet Momentum Pro!`;
  const defaultHtml = `
    <body style="margin:0;padding:0;background:#0f0f0f;font-family:sans-serif;">
      <div style="max-width:540px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
        <div style="background:#FF6E00;padding:32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:1px;">Sweet Momentum</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Daily Performance Tracking</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#e0e0e0;font-size:16px;margin:0 0 16px;">Hey {{displayName}},</p>
          <p style="color:#e0e0e0;font-size:15px;margin:0 0 24px;">
            Great news — your Sweet Momentum account has been <strong style="color:#FF6E00;">upgraded to Pro</strong>. You now have access to all Pro features including custom metrics and the Score Map.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${APP_URL}" style="display:inline-block;background:#FF6E00;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;letter-spacing:0.5px;">
              Go to Sweet Momentum
            </a>
          </div>
          <p style="color:#666;font-size:12px;text-align:center;margin:0;">
            Questions? Reply to this email and we'll be happy to help.
          </p>
        </div>
      </div>
    </body>
  `;
  const defaultText = `Hey {{displayName}},\n\nYour Sweet Momentum account has been upgraded to Pro! You now have access to all Pro features.\n\nVisit the app: ${APP_URL}\n\nQuestions? Reply to this email.`;

  // ── Try DB template, fall back to default ──
  let subject = defaultSubject;
  let html    = defaultHtml;
  let text    = defaultText;

  try {
    const tpl = await storage.getEmailTemplate("upgrade");
    if (tpl) {
      const interpolate = (s: string) => s.replace(/\{\{displayName\}\}/g, displayName);
      subject = interpolate(tpl.subject);
      html    = interpolate(tpl.bodyHtml);
      text    = interpolate(tpl.bodyText);
    }
  } catch (dbErr) {
    console.warn("[email] Could not load upgrade template from DB, using default:", dbErr);
  }

  try {
    await transporter.sendMail({ from: fromAddress, to: toEmail, subject, html, text });
    console.log(`[email] Upgrade email sent to ${toEmail}`);
  } catch (smtpErr: any) {
    console.error(`[email] SMTP error sending upgrade email to ${toEmail}:`, smtpErr?.message || smtpErr);
  }
}

// ── Send coaching request notification ───────────────────────────────────────
export async function sendCoachingRequestEmail(opts: {
  userName: string;
  userEmail: string;
  preferredDate: string;
  timezone: string;
  topic: string;
}): Promise<void> {
  const { userName, userEmail, preferredDate, timezone, topic } = opts;
  const transporter = createTransporter();
  const fromAddress = SMTP_FROM_EMAIL
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
    : `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  // Email to admin
  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: "track@sweetmo.io",
        replyTo: userEmail,
        subject: `New Coaching Request — ${userName}`,
        html: `
          <body style="margin:0;padding:0;background:#0f0f0f;font-family:sans-serif;">
            <div style="max-width:540px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
              <div style="background:#FF6E00;padding:24px 32px;">
                <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">New Coaching Request</h1>
                <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Sweet Momentum Pro</p>
              </div>
              <div style="padding:28px 32px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;width:120px;">Name</td><td style="padding:6px 0;color:#e0e0e0;font-size:14px;">${userName}</td></tr>
                  <tr><td style="padding:6px 0;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;">Email</td><td style="padding:6px 0;color:#e0e0e0;font-size:14px;"><a href="mailto:${userEmail}" style="color:#FF6E00;">${userEmail}</a></td></tr>
                  <tr><td style="padding:6px 0;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;">Preferred Time</td><td style="padding:6px 0;color:#e0e0e0;font-size:14px;">${preferredDate}</td></tr>
                  <tr><td style="padding:6px 0;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;">Timezone</td><td style="padding:6px 0;color:#e0e0e0;font-size:14px;">${timezone || "Not specified"}</td></tr>
                  <tr><td style="padding:6px 0;color:#888;font-size:12px;font-weight:700;text-transform:uppercase;vertical-align:top;">Topic</td><td style="padding:6px 0;color:#e0e0e0;font-size:14px;">${topic || "Not specified"}</td></tr>
                </table>
                <p style="margin:24px 0 0;color:#888;font-size:12px;">Reply directly to this email to respond to ${userName}.</p>
              </div>
            </div>
          </body>
        `,
        text: `New Coaching Request\n\nName: ${userName}\nEmail: ${userEmail}\nPreferred Time: ${preferredDate}\nTimezone: ${timezone}\nTopic: ${topic}\n\nReply to this email to respond.`,
      });
      console.log(`[email] Coaching request notification sent for ${userEmail}`);
    } catch (e: any) {
      console.error("[email] Coaching request admin email error:", e?.message);
    }
  }

  // Confirmation email to user
  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: userEmail,
        subject: "Your coaching session request — Sweet Momentum",
        html: `
          <body style="margin:0;padding:0;background:#0f0f0f;font-family:sans-serif;">
            <div style="max-width:540px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
              <div style="background:#FF6E00;padding:32px;text-align:center;">
                <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">Request Received</h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Sweet Momentum Coaching</p>
              </div>
              <div style="padding:32px;">
                <p style="color:#e0e0e0;font-size:15px;margin:0 0 16px;">Hi ${userName},</p>
                <p style="color:#e0e0e0;font-size:14px;margin:0 0 24px;">Thanks for requesting a coaching session! We've received your request and will be in touch shortly with a confirmed Zoom link.</p>
                <div style="background:#252525;border-radius:8px;padding:16px;margin:0 0 24px;">
                  <p style="margin:0 0 6px;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;">Your Preferred Time</p>
                  <p style="margin:0;color:#fff;font-size:14px;">${preferredDate} ${timezone ? `(${timezone})` : ""}</p>
                  ${topic ? `<p style="margin:10px 0 4px;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;">Topic</p><p style="margin:0;color:#fff;font-size:14px;">${topic}</p>` : ""}
                </div>
                <p style="color:#888;font-size:12px;margin:0;">Questions? Reply to this email or reach us at <a href="mailto:track@sweetmo.io" style="color:#FF6E00;">track@sweetmo.io</a></p>
              </div>
            </div>
          </body>
        `,
        text: `Hi ${userName},\n\nThanks for requesting a coaching session! We've received your request and will be in touch with a Zoom link.\n\nPreferred Time: ${preferredDate} ${timezone}\nTopic: ${topic}\n\nQuestions? Email track@sweetmo.io`,
      });
    } catch (e: any) {
      console.error("[email] Coaching confirmation email error:", e?.message);
    }
  }

  if (!transporter) {
    console.log(`[email] SMTP not configured. Coaching request from ${userEmail}`);
  }
}

// ── Send welcome email on first registration ──────────────────────────────────
export async function sendWelcomeEmail(opts: {
  toEmail: string;
  displayName: string;
}): Promise<void> {
  const { toEmail, displayName } = opts;

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email] SMTP not configured. Welcome email for ${toEmail} skipped.`);
    return;
  }

  const fromAddress = SMTP_FROM_EMAIL
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
    : `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  // ── Default template ──
  const defaultSubject = `Welcome to Sweet Momentum, {{displayName}}!`;
  const defaultHtml = `
    <body style="margin:0;padding:0;background:#0f0f0f;font-family:sans-serif;">
      <div style="max-width:540px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
        <div style="background:#FF6E00;padding:32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:1px;">Sweet Momentum</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Daily Performance Tracking</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#e0e0e0;font-size:16px;margin:0 0 16px;">Hey {{displayName}},</p>
          <p style="color:#e0e0e0;font-size:15px;margin:0 0 16px;">
            Welcome to <strong style="color:#FF6E00;">Sweet Momentum</strong> — your daily performance tracking app. You're all set to start scoring your day across the 6 core metrics: Time, Goal, Team, Task, View, and Pace.
          </p>
          <p style="color:#e0e0e0;font-size:15px;margin:0 0 24px;">
            Head to the <strong style="color:#fff;">Today</strong> page to record your first daily score.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${APP_URL}" style="display:inline-block;background:#FF6E00;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:8px;letter-spacing:0.5px;">
              Go to Sweet Momentum
            </a>
          </div>
          <p style="color:#666;font-size:12px;text-align:center;margin:0;">
            Questions? Reply to this email — we're happy to help.
          </p>
        </div>
      </div>
    </body>
  `;
  const defaultText = `Hey {{displayName}},\n\nWelcome to Sweet Momentum! You're all set to start tracking your daily performance across 6 core metrics.\n\nHead to the Today page to record your first score:\n${APP_URL}\n\nQuestions? Reply to this email.`;

  // ── Try DB template, fall back to default ──
  let subject = defaultSubject;
  let html    = defaultHtml;
  let text    = defaultText;

  try {
    const tpl = await storage.getEmailTemplate("welcome");
    if (tpl) {
      const interpolate = (s: string) => s.replace(/\{\{displayName\}\}/g, displayName);
      subject = interpolate(tpl.subject);
      html    = interpolate(tpl.bodyHtml);
      text    = interpolate(tpl.bodyText);
    }
  } catch (dbErr) {
    console.warn("[email] Could not load welcome template from DB, using default:", dbErr);
  }

  // Final interpolation on defaults too
  const interpolate = (s: string) => s.replace(/\{\{displayName\}\}/g, displayName);
  subject = interpolate(subject);
  html    = interpolate(html);
  text    = interpolate(text);

  try {
    await transporter.sendMail({ from: fromAddress, to: toEmail, subject, html, text });
    console.log(`[email] Welcome email sent to ${toEmail}`);
  } catch (smtpErr: any) {
    console.error(`[email] SMTP error sending welcome email to ${toEmail}:`, smtpErr?.message || smtpErr);
  }
}

// ── Send weekly digest email ──────────────────────────────────────────────────
export async function sendWeeklyDigestEmail(opts: {
  toEmail: string;
  displayName: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
  entries: Array<{
    entryDate: string;
    score: number;
    scored: boolean;
    metrics: Array<{ label: string; rating: string }>;
  }>;
}): Promise<void> {
  const { toEmail, displayName, weekStart, weekEnd, entries } = opts;

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[email] SMTP not configured. Weekly digest for ${toEmail} skipped.`);
    return;
  }

  const fromAddress = SMTP_FROM_EMAIL
    ? `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`
    : `"${SMTP_FROM_NAME}" <${SMTP_USER}>`;

  const scoredEntries = entries.filter(e => e.scored);
  const totalScore   = scoredEntries.reduce((sum, e) => sum + e.score, 0);
  const avgScore     = scoredEntries.length > 0 ? (totalScore / scoredEntries.length).toFixed(1) : "—";
  const daysScored   = scoredEntries.length;
  const bestDay      = scoredEntries.length > 0 ? scoredEntries.reduce((a, b) => a.score >= b.score ? a : b) : null;

  // Format date label e.g. "Mon Mar 17"
  const fmtDate = (d: string) => {
    const dt = new Date(d + "T12:00:00Z");
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  };
  const fmtWeekRange = `${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`;

  // Rating pill colours
  const ratingColour = (r: string) =>
    r === "success" ? "#85FF00" : r === "setback" ? "#FF4444" : "#555";
  const ratingLabel = (r: string) =>
    r === "success" ? "✓" : r === "setback" ? "✗" : "–";

  // Build per-day rows
  const dayRows = entries.map(e => {
    if (!e.scored) {
      return `<tr><td style="padding:8px 12px;color:#555;font-size:13px;">${fmtDate(e.entryDate)}</td><td colspan="2" style="padding:8px 12px;color:#444;font-size:13px;">No score recorded</td></tr>`;
    }
    const pills = e.metrics.map(m =>
      `<span style="display:inline-block;background:${ratingColour(m.rating)};color:#0f0f0f;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin:1px;">${m.label} ${ratingLabel(m.rating)}</span>`
    ).join(" ");
    const scoreColour = e.score >= 7 ? "#FF6E00" : e.score >= 4 ? "#85FF00" : "#e0e0e0";
    return `<tr>
      <td style="padding:8px 12px;color:#e0e0e0;font-size:13px;white-space:nowrap;">${fmtDate(e.entryDate)}</td>
      <td style="padding:8px 12px;font-size:18px;font-weight:800;color:${scoreColour};white-space:nowrap;">${e.score}</td>
      <td style="padding:8px 12px;">${pills}</td>
    </tr>`;
  }).join("\n");

  // Plain-text version
  const textLines = entries.map(e => {
    if (!e.scored) return `${fmtDate(e.entryDate)}: No score recorded`;
    const pills = e.metrics.map(m => `${m.label}:${ratingLabel(m.rating)}`).join(" ");
    return `${fmtDate(e.entryDate)}: Score ${e.score}  ${pills}`;
  });

  const defaultSubject = `Your Sweet Momentum week in review — {{weekRange}}`;
  const defaultHtml = `
    <body style="margin:0;padding:0;background:#0f0f0f;font-family:sans-serif;">
      <div style="max-width:580px;margin:40px auto;background:#1a1a1a;border-radius:12px;overflow:hidden;">
        <div style="background:#FF6E00;padding:32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:1px;">Sweet Momentum</h1>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Weekly Summary — {{weekRange}}</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#e0e0e0;font-size:16px;margin:0 0 24px;">Hey {{displayName}},</p>

          <!-- Summary stats -->
          <div style="display:flex;gap:12px;margin-bottom:28px;">
            <div style="flex:1;background:#111;border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Days Scored</p>
              <p style="margin:6px 0 0;color:#FF6E00;font-size:28px;font-weight:800;">{{daysScored}}/7</p>
            </div>
            <div style="flex:1;background:#111;border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Avg Score</p>
              <p style="margin:6px 0 0;color:#85FF00;font-size:28px;font-weight:800;">{{avgScore}}</p>
            </div>
            <div style="flex:1;background:#111;border-radius:8px;padding:16px;text-align:center;">
              <p style="margin:0;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Best Day</p>
              <p style="margin:6px 0 0;color:#e0e0e0;font-size:16px;font-weight:700;">{{bestDay}}</p>
            </div>
          </div>

          <!-- Day-by-day table -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
            <thead>
              <tr style="border-bottom:1px solid #333;">
                <th style="text-align:left;padding:6px 12px;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;">Day</th>
                <th style="text-align:left;padding:6px 12px;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;">Score</th>
                <th style="text-align:left;padding:6px 12px;color:#888;font-size:11px;font-weight:700;text-transform:uppercase;">Metrics</th>
              </tr>
            </thead>
            <tbody>
              {{dayRows}}
            </tbody>
          </table>

          <div style="text-align:center;margin:32px 0;">
            <a href="${APP_URL}" style="display:inline-block;background:#FF6E00;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">
              Open Sweet Momentum
            </a>
          </div>
          <p style="color:#555;font-size:12px;text-align:center;margin:0;">
            You're receiving this because you have a Sweet Momentum account.<br>
            Reply to this email to unsubscribe.
          </p>
        </div>
      </div>
    </body>
  `;
  const defaultText = `Hey {{displayName}},\n\nYour Sweet Momentum week in review — {{weekRange}}\n\nDays scored: {{daysScored}}/7\nAvg score: {{avgScore}}\nBest day: {{bestDay}}\n\n${textLines.join("\n")}\n\nOpen the app: ${APP_URL}`;

  // ── Try DB template, fall back to default ──
  let subject = defaultSubject;
  let html    = defaultHtml;
  let text    = defaultText;

  try {
    const tpl = await storage.getEmailTemplate("weekly_digest");
    if (tpl) {
      subject = tpl.subject;
      html    = tpl.bodyHtml;
      text    = tpl.bodyText;
    }
  } catch (dbErr) {
    console.warn("[email] Could not load weekly_digest template from DB, using default:", dbErr);
  }

  // Interpolate all variables
  const bestDayLabel = bestDay ? fmtDate(bestDay.entryDate) : "—";
  const interpolate = (s: string) => s
    .replace(/\{\{displayName\}\}/g, displayName)
    .replace(/\{\{weekRange\}\}/g, fmtWeekRange)
    .replace(/\{\{daysScored\}\}/g, String(daysScored))
    .replace(/\{\{avgScore\}\}/g, String(avgScore))
    .replace(/\{\{bestDay\}\}/g, bestDayLabel)
    .replace(/\{\{dayRows\}\}/g, dayRows);

  subject = interpolate(subject);
  html    = interpolate(html);
  text    = interpolate(text);

  try {
    await transporter.sendMail({ from: fromAddress, to: toEmail, subject, html, text });
    console.log(`[email] Weekly digest sent to ${toEmail}`);
  } catch (smtpErr: any) {
    console.error(`[email] SMTP error sending weekly digest to ${toEmail}:`, smtpErr?.message || smtpErr);
  }
}
