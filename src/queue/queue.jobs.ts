export const QUEUE_JOBS = {
  SEND_VERIFICATION_OTP: 'send-verification-otp',
  SEND_OTP_EMAIL: 'send-otp-email',
  SEND_OTP_TELEGRAM: 'send-otp-telegram',
  INCREMENT_PROPERTY_VIEW: 'increment-property-view',
  PURGE_EXPIRED_TOKENS: 'purge-expired-tokens',
  SEND_FEEDBACK_NOTIFICATION: 'send-feedback-notification',
  WRITE_AUDIT_LOG: 'write-audit-log',
  SEND_PROPERTY_REPORTED_EMAIL: 'send-property-reported-email',
  SEND_PROPERTY_REPORTED_TELEGRAM: 'send-property-reported-telegram',
  SEND_PROPERTY_REPORT_ADMIN_ALERT: 'send-property-report-admin-alert',
  SEND_USER_REGISTERED_ADMIN_ALERT: 'send-user-registered-admin-alert',
  SEND_ERROR_ALERT: 'send-error-alert',
} as const;

export interface SendVerificationOtpJob {
  to: string;
  otp: string;
}

export interface SendOtpEmailJob {
  to: string;
  otp: string;
}

export interface SendOtpTelegramJob {
  chatId: string;
  otp: string;
}

export interface IncrementPropertyViewJob {
  propertyId: string;
}

export interface SendFeedbackNotificationJob {
  type: string;
  description: string;
  userName: string;
}

export interface WriteAuditLogJob {
  userId: string | null;
  action: string;
  route: string;
  resourceType: string;
  resourceId: string | null;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface SendPropertyReportedEmailJob {
  to: string;
  ownerName: string;
  propertyId: string;
  propertyTitle: string;
  reportTypeName: string;
}

export interface SendPropertyReportedTelegramJob {
  chatId: string;
  ownerName: string;
  propertyId: string;
  propertyTitle: string;
  reportTypeName: string;
}

export interface SendPropertyReportAdminAlertJob {
  propertyId: string;
  propertyTitle: string;
  reportTypeName: string;
  reporterName: string;
}

export interface SendUserRegisteredAdminAlertJob {
  userId: string;
  name: string;
  email: string;
  source: 'otp' | 'telegram' | 'google';
}

export interface SendErrorAlertJob {
  message: string;
  stack: string | null;
  method: string;
  route: string;
  timestamp: string;
}
