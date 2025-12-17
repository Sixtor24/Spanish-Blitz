import { useCallback, useState } from 'react';

type UploadInput =
  | { file: File }
  | { url: string }
  | { base64: string }
  | { buffer: BodyInit };

type UploadResult =
  | { url: string; mimeType: string | null }
  | { error: string };

function useUpload() {
  const [loading, setLoading] = useState(false);

  const upload = useCallback(async (input: UploadInput): Promise<UploadResult> => {
    try {
      setLoading(true);
      let response: Response;

      if ('file' in input && input.file) {
        const formData = new FormData();
        formData.append('file', input.file);
        response = await fetch('/_create/api/upload/', {
          method: 'POST',
          body: formData,
        });
      } else if ('url' in input) {
        response = await fetch('/_create/api/upload/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: input.url }),
        });
      } else if ('base64' in input) {
        response = await fetch('/_create/api/upload/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: input.base64 }),
        });
      } else if ('buffer' in input) {
        response = await fetch('/_create/api/upload/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: input.buffer,
        });
      } else {
        throw new Error('Unsupported upload input');
      }

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('Upload failed: File too large.');
        }
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return { url: data.url, mimeType: (data.mimeType as string | null) ?? null };
    } catch (uploadError) {
      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      if (typeof uploadError === 'string') {
        return { error: uploadError };
      }
      return { error: 'Upload failed' };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }] as const;
}

export { useUpload };
export default useUpload;