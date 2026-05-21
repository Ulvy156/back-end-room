export const QUEUE_JOBS = {
  SEND_VERIFICATION_OTP: 'send-verification-otp',
  SEND_OTP_EMAIL: 'send-otp-email',
  SEND_OTP_TELEGRAM: 'send-otp-telegram',
  INCREMENT_PROPERTY_VIEW: 'increment-property-view',
  PURGE_EXPIRED_TOKENS: 'purge-expired-tokens',
  SEND_FEEDBACK_NOTIFICATION: 'send-feedback-notification',
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
