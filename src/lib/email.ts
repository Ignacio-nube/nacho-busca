import nodemailer from 'nodemailer';
import { SmtpConfig, Contact, EmailTemplate } from '@/types';
import { interpolateTemplate } from './template';
import { randomUUID } from 'crypto';

export { interpolateTemplate };

export function createTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

export function buildMailOptions(
  config: SmtpConfig,
  contact: Contact,
  template: EmailTemplate,
  cvUrl: string,
  cvName: string
) {
  const subject = interpolateTemplate(template.subject, contact);
  const html = interpolateTemplate(
    template.body.replace(/\n/g, '<br>'),
    contact
  );
  const text = interpolateTemplate(template.body, contact);

  const messageId = `<${randomUUID()}@${config.host}>`;

  return {
    from: `"${config.fromName}" <${config.user}>`,
    to: contact.email,
    subject,
    html,
    text,
    messageId,
    headers: {
      'X-Mailer': 'cv-mailer/1.0',
      'Precedence': 'bulk',
      'X-Priority': '3',
      'Message-ID': messageId,
    },
    attachments: [
      {
        filename: cvName,
        path: cvUrl,
      },
    ],
  };
}
