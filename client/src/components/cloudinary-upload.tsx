import { useRef, useState } from "react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const CLOUD_NAME = "dlqmcinfq";
const UPLOAD_PRESET = "sweetmomentum";

interface CloudinaryUploadProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  hint?: string;
  /** Accepted image types — default "image/*" */
  accept?: string;
  /** Test ID prefix */
  testId?: string;
  /** Show a preview of the uploaded image */
  showPreview?: boolean;
  /** Max preview height in px */
  previewHeight?: number;
}

export function CloudinaryUpload({
  value,
  onChange,
  placeholder = "https://res.cloudinary.com/...",
  hint,
  accept = "image/*",
  testId = "cloudinary",
  showPreview = true,
  previewHeight = 128,
}: CloudinaryUploadProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;

    // 10 MB guard
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please choose an image under 10 MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    setPreviewError(false);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "sweet-momentum");

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      onChange(data.secure_url);
      toast({ title: "Image uploaded", description: "Your image is ready to use." });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  const hasImage = !!value;

  return (
    <div className="space-y-2">
      {/* URL input row */}
      <div className="flex gap-2 items-center">
        <Input
          value={value}
          onChange={e => { onChange(e.target.value); setPreviewError(false); }}
          placeholder={placeholder}
          className="text-sm font-mono flex-1"
          data-testid={`${testId}-url-input`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          data-testid={`${testId}-upload-btn`}
        >
          {uploading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="w-3.5 h-3.5" /> Upload</>
          )}
        </Button>
        {hasImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground hover:text-destructive px-2"
            onClick={() => { onChange(""); setPreviewError(false); }}
            data-testid={`${testId}-clear-btn`}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        data-testid={`${testId}-file-input`}
      />

      {/* Hint text */}
      {hint && <p className="text-[10px] text-muted-foreground/60">{hint}</p>}

      {/* Drop zone (shown when no image selected) */}
      {!hasImage && !uploading && (
        <div
          className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-lg py-5 text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          data-testid={`${testId}-dropzone`}
        >
          <ImageIcon className="w-6 h-6 opacity-40" />
          <span className="text-xs">Click or drag &amp; drop to upload</span>
        </div>
      )}

      {/* Upload progress placeholder */}
      {uploading && (
        <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-lg py-5 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin opacity-60" />
          <span className="text-xs">Uploading to Cloudinary…</span>
        </div>
      )}

      {/* Image preview */}
      {showPreview && hasImage && !previewError && !uploading && (
        <div
          className="rounded-lg overflow-hidden border border-border bg-muted"
          style={{ height: previewHeight }}
        >
          <img
            src={value}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={() => setPreviewError(true)}
          />
        </div>
      )}

      {/* Broken URL fallback */}
      {showPreview && hasImage && previewError && (
        <p className="text-[10px] text-destructive/70">Could not load image preview — check the URL.</p>
      )}
    </div>
  );
}
