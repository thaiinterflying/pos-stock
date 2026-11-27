'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_LABEL,
} from '@/lib/product-image';

type ProductImageInputProps = {
  currentImageUrl: string | null;
  disabled?: boolean;
  error?: string[];
};

export function ProductImageInput({
  currentImageUrl,
  disabled = false,
  error,
}: ProductImageInputProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const previewRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function clearPreview() {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
    setFileName(null);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    clearPreview();

    if (!file) return;

    if (!PRODUCT_IMAGE_ACCEPT.split(',').includes(file.type)) {
      setClientError('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP');
      event.target.value = '';
      return;
    }

    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setClientError(`รูปภาพต้องมีขนาดไม่เกิน ${PRODUCT_IMAGE_MAX_LABEL}`);
      event.target.value = '';
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    previewRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setFileName(file.name);
    setRemoveExisting(false);
  }

  const shownImageUrl = previewUrl ?? (removeExisting ? null : currentImageUrl);
  const messages = clientError ? [clientError] : error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {shownImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- endpoint ต้อง auth จึงใช้ next/image ไม่ได้
            <img
              src={shownImageUrl}
              alt="รูปสินค้า"
              className="size-full object-cover"
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">รูปสินค้า (ไม่บังคับ)</Label>
          <Input
            id="image"
            name="image"
            type="file"
            accept={PRODUCT_IMAGE_ACCEPT}
            disabled={disabled}
            onChange={handleFileChange}
            className="max-w-xs cursor-pointer file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary-foreground"
            aria-invalid={Boolean(messages?.length)}
          />
          <p className="text-xs text-muted-foreground">
            JPG, PNG หรือ WebP ขนาดไม่เกิน {PRODUCT_IMAGE_MAX_LABEL}
          </p>
          {fileName ? (
            <p className="text-xs text-muted-foreground">ไฟล์ที่เลือก: {fileName}</p>
          ) : null}
          {currentImageUrl && !previewUrl ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                name="removeImage"
                value="1"
                checked={removeExisting}
                disabled={disabled}
                onChange={(event) => setRemoveExisting(event.target.checked)}
                className="size-3.5 accent-primary"
              />
              ลบรูปปัจจุบัน
            </label>
          ) : null}
        </div>
      </div>

      {messages?.length ? <p className="text-xs text-destructive">{messages[0]}</p> : null}
    </div>
  );
}
