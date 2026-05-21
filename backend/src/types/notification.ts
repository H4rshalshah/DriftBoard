export interface WelcomeData {
  email: string;
  name: string;
  verificationUrl: string;
}

export interface ForgotPasswordData {
  email: string;
  name: string;
  token: string;
  resetUrl: string;
}

export interface EmailVerificationData {
  email: string;
  name: string;
  token: string;
  verifyUrl: string;
}

export interface DriftAlertData {
  email: string;
  projectId: string;
  endpointPath: string;
  severity: 'low' | 'medium' | 'breaking';
  changeType: string;
  detectedAt: Date;
  changes?: Array<{
    type: 'added' | 'removed' | 'modified';
    path: string;
    description?: string;
  }>;
  dashboardUrl: string;
  settingsUrl: string;
}

export interface WeeklyReportData {
  email: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  stats: {
    totalEndpointsMonitored: number;
    driftsDetected: number;
    projectsAffected: number;
  };
  projects?: Array<{
    name: string;
    driftCount: number;
    highestSeverity: string;
    lastDriftAt?: Date;
  }>;
  dashboardUrl: string;
  settingsUrl: string;
}

export interface WebhookPayload {
  type: string;
  payload: Record<string, any>;
  timestamp: string;
  deliveryId?: string;
}

export interface WebhookRegistrationData {
  projectId: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  active?: boolean;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  duration: number;
}