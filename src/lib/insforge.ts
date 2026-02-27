import { createClient } from '@insforge/sdk';

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;

export const insforge = createClient({ baseUrl, anonKey });

export const INSFORGE_URL = baseUrl;
export const INSFORGE_SERVICE_KEY = process.env.INSFORGE_SERVICE_KEY!;
