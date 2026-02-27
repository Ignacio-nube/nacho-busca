import { NextRequest, NextResponse } from 'next/server';
import { createTransporter } from '@/lib/email';
import { SmtpConfig } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const config: SmtpConfig = await request.json();

    if (!config.host || !config.user || !config.password) {
      return NextResponse.json(
        { error: 'Faltan datos de configuración SMTP' },
        { status: 400 }
      );
    }

    const transporter = createTransporter(config);
    await transporter.verify();

    return NextResponse.json({
      success: true,
      message: 'Conexión SMTP verificada correctamente',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { error: `Error de conexión: ${message}` },
      { status: 400 }
    );
  }
}
