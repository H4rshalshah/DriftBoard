import nodemailer, { Transporter } from 'nodemailer';
import { ForgotPasswordData, WelcomeData, EmailVerificationData, DriftAlertData, WeeklyReportData } from '../types/notification';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailService {
  private transporter: Transporter;
  private config: EmailConfig;

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'h4rshal.workspace@gmail.com',
        pass: process.env.SMTP_PASS || 'mvmm cmsl xrgu ztwl',
      },
      from: process.env.EMAIL_FROM || 'DriftBoard <h4rshal.workspace@gmail.com>',
    };

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        html,
      });
      return true;
    } catch (error) {
      console.error('Email send failed:', error);
      return false;
    }
  }

  async sendWelcome(data: WelcomeData): Promise<boolean> {
    const html = this.getWelcomeTemplate(data);
    return this.sendEmail(data.email, 'Welcome to DriftBoard!', html);
  }

  async sendPasswordReset(data: ForgotPasswordData): Promise<boolean> {
    const html = this.getPasswordResetTemplate(data);
    return this.sendEmail(data.email, 'Reset Your Password', html);
  }

  async sendEmailVerification(data: EmailVerificationData): Promise<boolean> {
    const html = this.getEmailVerificationTemplate(data);
    return this.sendEmail(data.email, 'Verify Your Email', html);
  }

  async sendDriftAlert(email: string, data: DriftAlertData): Promise<boolean> {
    const html = this.getDriftAlertTemplate(data);
    return this.sendEmail(email, `🚨 API Drift Alert: ${data.severity.toUpperCase()}`, html);
  }

  async sendWeeklyReport(data: WeeklyReportData): Promise<boolean> {
    const html = this.getWeeklyReportTemplate(data);
    return this.sendEmail(data.email, '📊 Your Weekly Drift Report', html);
  }

  private getWelcomeTemplate(data: WelcomeData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 40px 20px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .features { margin: 30px 0; }
    .feature { display: flex; align-items: center; margin: 15px 0; }
    .feature-icon { width: 40px; height: 40px; background: #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; margin-right: 15px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">Welcome to DriftBoard, ${data.name}! 🎉</h1>
    </div>
    <div class="content">
      <p style="font-size: 18px;">We're excited to have you on board. DriftBoard helps you monitor and detect API changes before they break your integrations.</p>
      
      <div class="features">
        <div class="feature">
          <div class="feature-icon">📊</div>
          <div>
            <strong>Real-time Monitoring</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">Track API changes as they happen</p>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">🔔</div>
          <div>
            <strong>Smart Alerts</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">Get notified via Slack, Discord, or Email</p>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">📈</div>
          <div>
            <strong>Weekly Reports</strong>
            <p style="margin: 5px 0 0 0; color: #64748b;">Stay informed with digest summaries</p>
          </div>
        </div>
      </div>

      <a href="${data.verificationUrl}" class="button">Get Started</a>
      
      <p style="margin-top: 30px;">If you didn't create this account, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DriftBoard. All rights reserved.</p>
      <p>This email was sent to ${data.email}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getPasswordResetTemplate(data: ForgotPasswordData): string {
    const resetUrl = `${data.resetUrl}?token=${data.token}`;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 40px 20px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: #f5576c; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .code { background: #1a1a2e; color: #f5576c; padding: 10px 20px; border-radius: 8px; font-family: monospace; font-size: 18px; display: inline-block; margin: 15px 0; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">Reset Your Password 🔐</h1>
    </div>
    <div class="content">
      <p style="font-size: 18px;">Hi ${data.name},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      
      <a href="${resetUrl}" class="button">Reset Password</a>
      
      <p style="margin-top: 30px;">Or copy this link:</p>
      <div class="code">${resetUrl}</div>
      
      <div class="warning">
        <strong>⚠️ Security Notice:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>This link expires in 1 hour</li>
          <li>If you didn't request this, please ignore this email</li>
          <li>Never share this link with anyone</li>
        </ul>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DriftBoard. All rights reserved.</p>
      <p>This email was sent to ${data.email}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getEmailVerificationTemplate(data: EmailVerificationData): string {
    const verifyUrl = `${data.verifyUrl}?token=${data.token}`;
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 40px 20px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: #11998e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
    .success-icon { font-size: 60px; text-align: center; margin-bottom: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 28px;">Verify Your Email ✅</h1>
    </div>
    <div class="content">
      <div class="success-icon">✉️</div>
      <p style="font-size: 18px;">Hi ${data.name},</p>
      <p>Please verify your email address to activate your DriftBoard account. Click the button below:</p>
      
      <a href="${verifyUrl}" class="button">Verify Email</a>
      
      <p style="margin-top: 30px;">This verification link will expire in 24 hours.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DriftBoard. All rights reserved.</p>
      <p>This email was sent to ${data.email}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getDriftAlertTemplate(data: DriftAlertData): string {
    const severityColors: Record<string, { bg: string; text: string; border: string }> = {
      low: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
      medium: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
      breaking: { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
    };
    const colors = severityColors[data.severity] || severityColors.low;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 30px 20px; border-radius: 0 0 12px 12px; }
    .severity-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; text-transform: uppercase; font-size: 12px; }
    .drift-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .endpoint { font-family: monospace; background: #1a1a2e; color: #38ef7d; padding: 10px 15px; border-radius: 6px; display: inline-block; }
    .changes-list { background: white; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .change-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .change-item:last-child { border-bottom: none; }
    .change-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .change-type.added { background: #dcfce7; color: #166534; }
    .change-type.removed { background: #fee2e2; color: #991b1b; }
    .change-type.modified { background: #fef3c7; color: #92400e; }
    .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 15px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">🚨 API Drift Detected</h1>
      <span class="severity-badge" style="background: white; color: #ef4444; margin-top: 10px;">${data.severity.toUpperCase()} SEVERITY</span>
    </div>
    <div class="content">
      <p style="font-size: 16px;">Changes have been detected in your API that may affect your integrations.</p>
      
      <div class="drift-card">
        <h3 style="margin-top: 0; color: #64748b; font-size: 14px; text-transform: uppercase;">Affected Endpoint</h3>
        <span class="endpoint">${data.endpointPath}</span>
        
        <h3 style="margin-top: 20px; color: #64748b; font-size: 14px; text-transform: uppercase;">Detection Time</h3>
        <p style="margin: 0;">${new Date(data.detectedAt).toLocaleString()}</p>
      </div>
      
      ${data.changes && data.changes.length > 0 ? `
      <h3 style="color: #1a1a2e;">Detected Changes:</h3>
      <div class="changes-list">
        ${data.changes.map((change: any) => `
          <div class="change-item">
            <span class="change-type ${change.type}">${change.type.toUpperCase()}</span>
            <strong style="margin-left: 10px;">${change.path}</strong>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">${change.description || 'No description'}</p>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <a href="${data.dashboardUrl}" class="button">View Details →</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DriftBoard. All rights reserved.</p>
      <p>Manage notification preferences in your <a href="${data.settingsUrl}">settings</a>.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private getWeeklyReportTemplate(data: WeeklyReportData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 30px 20px; border-radius: 0 0 12px 12px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stat-number { font-size: 32px; font-weight: 700; color: #667eea; }
    .stat-label { color: #64748b; font-size: 12px; text-transform: uppercase; }
    .project-card { background: white; border-radius: 8px; padding: 15px; margin: 10px 0; border-left: 4px solid #667eea; }
    .severity-low { border-left-color: #3b82f6; }
    .severity-medium { border-left-color: #f59e0b; }
    .severity-breaking { border-left-color: #ef4444; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 15px; }
    .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">📊 Weekly Drift Report</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${data.periodStart.toLocaleDateString()} - ${data.periodEnd.toLocaleDateString()}</p>
    </div>
    <div class="content">
      <p style="font-size: 16px;">Hi ${data.name},</p>
      <p>Here's your weekly API drift summary:</p>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">${data.stats.totalEndpointsMonitored}</div>
          <div class="stat-label">Endpoints Monitored</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${data.stats.driftsDetected}</div>
          <div class="stat-label">Drifts Detected</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">${data.stats.projectsAffected}</div>
          <div class="stat-label">Projects Affected</div>
        </div>
      </div>
      
      ${data.projects && data.projects.length > 0 ? `
      <h3 style="color: #1a1a2e; margin-top: 30px;">Projects with Changes:</h3>
      ${data.projects.map((project: any) => `
        <div class="project-card severity-${project.highestSeverity}">
          <h4 style="margin: 0 0 10px 0;">${project.name}</h4>
          <p style="margin: 0; color: #64748b; font-size: 14px;">
            ${project.driftCount} drift${project.driftCount !== 1 ? 's' : ''} detected
            ${project.lastDriftAt ? ` • Last: ${new Date(project.lastDriftAt).toLocaleDateString()}` : ''}
          </p>
        </div>
      `).join('')}
      ` : '<p style="text-align: center; color: #64748b; margin-top: 30px;">✅ No drifts detected this week!</p>'}
      
      <a href="${data.dashboardUrl}" class="button">View Dashboard →</a>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} DriftBoard. All rights reserved.</p>
      <p>Manage notification preferences in your <a href="${data.settingsUrl}">settings</a>.</p>
    </div>
  </div>
</body>
</html>`;
  }
}

export const emailService = new EmailService();
