import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly senderAddress: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(configService: ConfigService) {
    this.senderAddress = configService.getOrThrow<string>('GMAIL_USER');

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.senderAddress,
        pass: configService.getOrThrow<string>('GMAIL_APP_PASSWORD'),
      },
    });
  }

  async sendVerificationOtp(to: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Rent Room" <${this.senderAddress}>`,
        to,
        subject: 'Verify your Rent Room account',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Welcome to Rent Room! 👋</h2>
            <p>Thanks for signing up. Use the OTP below to verify your account. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                        padding:16px;background:#f4f4f4;border-radius:8px;margin:24px 0">
              ${otp}
            </div>
            <p style="color:#888;font-size:13px">If you did not create this account, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification OTP email to ${to}`,
        error,
      );
      throw error;
    }
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Rent Room" <${this.senderAddress}>`,
        to,
        subject: 'Your Password Reset OTP',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>Password Reset</h2>
            <p>Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;
                        padding:16px;background:#f4f4f4;border-radius:8px;margin:24px 0">
              ${otp}
            </div>
            <p style="color:#888;font-size:13px">If you did not request this, ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error);
      throw error;
    }
  }

  async sendPropertyReported(
    to: string,
    ownerName: string,
    propertyId: string,
    propertyTitle: string,
    reportTypeName: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Rent Room" <${this.senderAddress}>`,
        to,
        subject: 'Your listing was reported',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2>⚠️ Your listing was reported</h2>
            <p>Hi ${ownerName},</p>
            <p>Your property listing <strong>${propertyTitle}</strong> (ID: ${propertyId}) was reported for: <strong>${reportTypeName}</strong>.</p>
            <p>Please review your listing to make sure it complies with our guidelines.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send property-reported email to ${to}`,
        error,
      );
      throw error;
    }
  }
}
