import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@insforge/sdk';
import { INSFORGE_URL, INSFORGE_SERVICE_KEY } from '@/lib/insforge';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function getClient() {
  return createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_SERVICE_KEY });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('cv') as File | null;
    const profileId = formData.get('profileId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }
    if (!profileId) {
      return NextResponse.json({ error: 'profileId requerido' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 10MB' }, { status: 400 });
    }

    const client = getClient();

    const { data: storageData, error: storageError } = await client.storage
      .from('cv-uploads')
      .uploadAuto(file);

    if (storageError || !storageData) {
      console.error('Storage error:', storageError);
      return NextResponse.json({ error: 'Error al subir el archivo al storage' }, { status: 500 });
    }

    const uploadedAt = new Date().toISOString();

    await client.database
      .from('app_config')
      .update({
        cv_storage_key: storageData.key,
        cv_storage_url: storageData.url,
        cv_original_name: file.name,
        cv_size: file.size,
        cv_uploaded_at: uploadedAt,
        updated_at: uploadedAt,
      })
      .eq('profile_id', profileId);

    return NextResponse.json({
      success: true,
      name: file.name,
      size: file.size,
      uploadedAt,
      storageKey: storageData.key,
      storageUrl: storageData.url,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 });
  }
}
