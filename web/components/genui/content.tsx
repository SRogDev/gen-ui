"use client";

import {
  Archive,
  Download,
  File,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Video,
} from "lucide-react";
import { useState } from "react";
import { getSignedUrl, isStorageConfigured } from "@/lib/attachments/storage";
import type { GenUIComponent } from "@/lib/genui/schemas";
import { cn } from "@/lib/utils";

type ImageProps = Extract<GenUIComponent, { component: "Image" }>;
type FilePreviewProps = Extract<GenUIComponent, { component: "FilePreview" }>;

export function GenUIImage({ url, alt, caption }: ImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-depth p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-text-tertiary">
          <ImageIcon className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-xs text-text-tertiary">
          No se pudo cargar la imagen: {alt}
        </p>
      </div>
    );
  }

  return (
    <figure className="overflow-hidden rounded-xl border border-white/[0.08] bg-depth shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      {/* The URL passed Zod's http(s) validation; never render unvalidated src. */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-h-80 w-full object-cover"
      />
      {caption ? (
        <figcaption className="px-4 py-2 text-xs text-text-tertiary">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function iconForMediaType(mediaType: string) {
  const mt = mediaType.toLowerCase();
  if (mt.startsWith("image/")) return ImageIcon;
  if (mt.startsWith("audio/")) return Music;
  if (mt.startsWith("video/")) return Video;
  if (mt.includes("zip") || mt.includes("archive") || mt.includes("compressed"))
    return Archive;
  if (
    mt.includes("pdf") ||
    mt.includes("text") ||
    mt.includes("json") ||
    mt.includes("csv") ||
    mt.includes("sheet") ||
    mt.includes("excel") ||
    mt.includes("word") ||
    mt.includes("document")
  )
    return FileText;
  return File;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GenUIFilePreview({ file, title }: FilePreviewProps) {
  const Icon = iconForMediaType(file.media_type);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // U6: file_id doubles as the Storage object path inside the
  // chat-attachments bucket (see docs/attachments-u6.md). Signed URLs keep
  // the bucket private; the button only appears when Storage is configured.
  const canDownload = isStorageConfigured();

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const url = await getSignedUrl(file.file_id, 300);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-white/[0.08]",
        "bg-depth p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ember/10 text-ember">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {title ?? file.filename}
        </p>
        <p className="mt-0.5 font-mono text-xs text-text-tertiary">
          {file.media_type} · {formatBytes(file.size_bytes)}
        </p>
        {downloadError && (
          <p className="mt-1 text-xs text-error">{downloadError}</p>
        )}
      </div>
      {canDownload && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          aria-label={`Descargar ${file.filename}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-slate-100 disabled:opacity-40"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
