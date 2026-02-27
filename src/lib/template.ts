import { Contact } from '@/types';

export function interpolateTemplate(template: string, contact: Contact): string {
  return template
    .replace(/\{\{company\}\}/g, contact.company || '')
    .replace(/\{\{email\}\}/g, contact.email || '');
}
