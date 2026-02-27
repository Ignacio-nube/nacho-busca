'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, CheckCircle, Trash2, AlertCircle } from 'lucide-react';
import { CvFile } from '@/types';

interface Props {
  cvFile: CvFile | null;
  onChange: (cv: CvFile | null) => void;
  profileId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CVUploader({ cvFile, onChange, profileId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
        setError('Solo se aceptan archivos PDF');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo supera los 10MB');
        return;
      }

      setError('');
      setUploading(true);

      const formData = new FormData();
      formData.append('cv', file);
      formData.append('profileId', profileId);

      try {
        const res = await fetch('/api/upload-cv', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Error al subir');
        }
        onChange({
          name: data.name,
          size: data.size,
          uploadedAt: data.uploadedAt,
          storageKey: data.storageKey,
          storageUrl: data.storageUrl,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [onChange, profileId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileText size={20} className="text-blue-600" />
          Subir CV (PDF)
        </h2>

        {cvFile ? (
          <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle size={32} className="text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{cvFile.name}</p>
              <p className="text-sm text-gray-500">
                {formatBytes(cvFile.size)} · Subido {new Date(cvFile.uploadedAt).toLocaleString('es-ES')}
              </p>
            </div>
            <button
              onClick={() => onChange(null)}
              className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
              title="Eliminar CV"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-blue-600 font-medium">Subiendo a la nube...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Upload size={40} className={isDragActive ? 'text-blue-500' : 'text-gray-400'} />
                <div>
                  <p className="font-medium text-gray-700">
                    {isDragActive ? 'Suelta el PDF aquí' : 'Arrastra tu CV aquí'}
                  </p>
                  <p className="text-sm mt-1">o haz clic para seleccionarlo</p>
                  <p className="text-xs mt-2 text-gray-400">Solo PDF · Máximo 10MB</p>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Almacenamiento en la nube:</strong> El CV se guarda en InsForge Storage y está disponible en Vercel.
      </div>
    </div>
  );
}
