import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { Contact } from '@/types';

type RawRow = Record<string, string>;

function findColumn(row: RawRow, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const key = keys.find((k) => k.toLowerCase().trim() === alias.toLowerCase());
    if (key) return row[key]?.trim() || '';
  }
  return '';
}

export function parseCsvToContacts(csvContent: string): Contact[] {
  const result = Papa.parse<RawRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const mapped: (Contact | null)[] = result.data.map((row) => {
    const email = findColumn(row, ['email', 'correo', 'mail', 'e-mail', 'contact email', 'email address']);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

    const contact: Contact = {
      id: uuidv4(),
      email,
      company: findColumn(row, ['company', 'empresa', 'organización', 'organization', 'compañia', 'compañía', 'nombre empresa', 'company name']),
      status: 'pending',
    };
    return contact;
  });

  return mapped.filter((c): c is Contact => c !== null);
}

export const CSV_TEMPLATE_EXAMPLE =
  'empresa,email\n' +
  'Inmobiliaria García,contacto@inmobiliaria-garcia.com\n' +
  'Grupo Viviendas Madrid,info@grupoviviendas.es\n' +
  'Pisos Online S.L.,rrhh@pisosonline.com\n';
