import axios from 'axios';
import { INotification, NotificationType } from '../models/Notification';

export class NotificationService {
  async sendSlack(webhookUrl: string, message: { text: string; blocks?: any[] }): Promise<boolean> {
    try {
      await axios.post(webhookUrl, message);
      return true;
    } catch (error) {
      console.error('Slack notification failed:', error);
      return false;
    }
  }

  async sendDiscord(webhookUrl: string, embed: { title: string; description: string; color: number; fields?: any[] }): Promise<boolean> {
    try {
      await axios.post(webhookUrl, { embeds: [embed] });
      return true;
    } catch (error) {
      console.error('Discord notification failed:', error);
      return false;
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const { emailService } = require('./emailService');
    return await emailService.sendEmail(to, subject, html);
  }

  async triggerForDrift(notification: INotification, driftData: {
    severity: 'low' | 'medium' | 'breaking';
    endpointPath: string;
    changeType: string;
    detectedAt: Date;
    projectId: string;
  }): Promise<void> {
    const severityColors: Record<string, number> = {
      low: 0x3B82F6,
      medium: 0xF59E0B,
      breaking: 0xEF4444,
    };
    const color = severityColors[driftData.severity] || 0x3B82F6;

    if (notification.type === NotificationType.SLACK) {
      await this.sendSlack(notification.config.webhookUrl, {
        text: `🚨 API Drift Detected: ${driftData.severity.toUpperCase()}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🚨 API Drift Detected' },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Severity:*\n${driftData.severity.toUpperCase()}` },
              { type: 'mrkdwn', text: `*Endpoint:*\n${driftData.endpointPath}` },
              { type: 'mrkdwn', text: `*Change Type:*\n${driftData.changeType}` },
            ],
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `Detected at: ${new Date(driftData.detectedAt).toISOString()}` }],
          },
        ],
      });
    } else if (notification.type === NotificationType.DISCORD) {
      await this.sendDiscord(notification.config.webhookUrl, {
        title: `API Drift: ${driftData.severity.toUpperCase()}`,
        description: `Change detected in ${driftData.endpointPath}`,
        color,
        fields: [
          { name: 'Severity', value: driftData.severity.toUpperCase(), inline: true },
          { name: 'Change Type', value: driftData.changeType, inline: true },
          { name: 'Detected At', value: new Date(driftData.detectedAt).toISOString(), inline: false },
        ],
      });
    } else if (notification.type === NotificationType.EMAIL) {
      const { emailService } = require('./emailService');
      await emailService.sendDriftAlert(notification.config.email, driftData);
    } else if (notification.type === NotificationType.WEBHOOK) {
      const { webhookService } = require('./webhookService');
      await webhookService.deliver(notification.config.webhookUrl, {
        type: 'DRIFT_DETECTED',
        payload: driftData,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async sendBatch(notifications: INotification[], driftData: any): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    await Promise.all(
      notifications.map(async (notification) => {
        try {
          await this.triggerForDrift(notification, driftData);
          results.set(notification._id?.toString() || notification.id, true);
        } catch (error) {
          console.error(`Notification failed for ${notification._id}:`, error);
          results.set(notification._id?.toString() || notification.id, false);
        }
      })
    );

    return results;
  }
}

export const notificationService = new NotificationService();
