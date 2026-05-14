import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export const EMAIL_SERVICE = Symbol('EMAIL_SERVICE');

export interface IEmailService {
  sendTemporaryPassword(
    to: string,
    firstName: string,
    temporaryPassword: string,
  ): Promise<void>;

  sendAtsAcceptanceEmail(
    to: string,
    firstName: string,
    temporaryPassword: string,
    jobTitle: string,
  ): Promise<void>;
}

@Injectable()
export class EmailService implements IEmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zoho.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendTemporaryPassword(
    to: string,
    firstName: string,
    temporaryPassword: string,
  ): Promise<void> {
    const platformName = process.env.PLATFORM_NAME || 'MindTalent';
    const platformUrl =
      process.env.PLATFORM_URL || 'https://mindeval.mindtalentth.com';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #23234a, #2e2e5e); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #f9b313; margin: 0; font-size: 24px;">${platformName}</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Plataforma de Evaluacion Psicometrica</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Bienvenido/a, ${firstName}</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Se ha creado una cuenta para usted en la plataforma de evaluacion psicometrica.
            A continuacion encontrara sus credenciales de acceso:
          </p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Correo electronico:</p>
            <p style="margin: 0 0 16px 0; color: #1f2937; font-weight: bold;">${to}</p>
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Contrasena temporal:</p>
            <p style="margin: 0; color: #1f2937; font-weight: bold; font-size: 18px; letter-spacing: 1px;">${temporaryPassword}</p>
          </div>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Importante:</strong> Al iniciar sesion por primera vez debera cambiar su contrasena.
            </p>
          </div>
          <a href="${platformUrl}/login" style="display: inline-block; background: #f9b313; color: #23234a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
            Iniciar Sesion
          </a>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
          Este es un correo automatico, por favor no responda a este mensaje.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${platformName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: `${platformName} - Credenciales de acceso`,
        html,
      });
      this.logger.log(`Temporary password email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async sendAtsAcceptanceEmail(
    to: string,
    firstName: string,
    temporaryPassword: string,
    jobTitle: string,
  ): Promise<void> {
    const platformName = process.env.PLATFORM_NAME || 'MindTalent';
    const platformUrl =
      process.env.PLATFORM_URL || 'https://mindeval.mindtalentth.com';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #23234a, #2e2e5e); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #f9b313; margin: 0; font-size: 24px;">${platformName}</h1>
          <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">Plataforma de Evaluacion Psicometrica</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Felicidades ${firstName}</h2>
          <p style="color: #4b5563; line-height: 1.6;">
            Su postulacion para el cargo <strong>${jobTitle}</strong> ha sido seleccionada
            para pasar a la siguiente etapa: <strong>evaluacion psicometrica</strong>.
          </p>
          <p style="color: #4b5563; line-height: 1.6;">
            A continuacion encontrara sus credenciales de acceso para rendir las pruebas:
          </p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Correo electronico:</p>
            <p style="margin: 0 0 16px 0; color: #1f2937; font-weight: bold;">${to}</p>
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">Contrasena temporal:</p>
            <p style="margin: 0; color: #1f2937; font-weight: bold; font-size: 18px; letter-spacing: 1px;">${temporaryPassword}</p>
          </div>
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">
              <strong>Importante:</strong> Al iniciar sesion por primera vez debera cambiar su contrasena.
              El examinador le indicara cuando rendir las pruebas.
            </p>
          </div>
          <a href="${platformUrl}/login" style="display: inline-block; background: #f9b313; color: #23234a; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
            Iniciar Sesion
          </a>
        </div>
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
          Este es un correo automatico, por favor no responda a este mensaje.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"${platformName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject: `${platformName} - Avanzaste a evaluacion psicometrica (${jobTitle})`,
        html,
      });
      this.logger.log(`ATS acceptance email sent to ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ATS acceptance email to ${to}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
