/** One bounded image job at a time; worker termination releases its decoded image. */
export async function prepareScanImage(blob: Blob, rotation = 0, crop = false, signal?: AbortSignal): Promise<Blob> {
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined") {
    try {
      return await new Promise<Blob>((resolve, reject) => {
        const worker = new Worker(new URL("./scan-image.worker.ts", import.meta.url));
        const finish = (error?: Error, output?: Blob) => { clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.terminate(); error ? reject(error) : resolve(output!); };
        const abort = () => finish(new DOMException("Cancelled", "AbortError"));
        const timer = setTimeout(() => finish(new Error("Photo processing took too long. Choose a smaller photo and retry.")), 30000);
        signal?.addEventListener("abort", abort, { once: true });
        worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string; fallback?: boolean }>) => {
          const error = event.data.error ? new Error(event.data.error) : undefined;
          if (error && event.data.fallback) error.name = "WorkerUnavailable";
          finish(error, event.data.blob);
        };
        worker.onerror = () => { const error = new Error("Photo processing unavailable"); error.name = "WorkerUnavailable"; finish(error); };
        try { worker.postMessage({ blob, rotation, crop }); } catch { finish(new Error("Unable to prepare this photo. Retake it.")); }
      });
    } catch (cause) {
      if (signal?.aborted || !(cause instanceof Error) || !["WorkerUnavailable", "SecurityError"].includes(cause.name)) throw cause;
      /* Native decoding is retained for browsers/formats without worker support. */
    }
  }
  return await new Promise<Blob>((resolve, reject) => {
    const url = URL.createObjectURL(blob), image = new Image();
    let done = false;
    const finish = (error?: Error, output?: Blob) => { if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener("abort", abort); URL.revokeObjectURL(url); image.src = ""; error ? reject(error) : resolve(output!); };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Photo processing took too long. Retake or choose a smaller photo.")), 30000);
    signal?.addEventListener("abort", abort, { once: true });
    image.onerror = () => finish(new Error("Unable to open this photo. Choose JPEG/PNG or retake it."));
    image.onload = () => {
      if (done) return;
      try {
        if (image.naturalWidth * image.naturalHeight > 80_000_000) throw new Error("Photo is too large. Choose a lower-resolution photo.");
        const border = crop ? 0.05 : 0, quarter = rotation % 180 !== 0;
        const width = image.naturalWidth * (1 - border * 2), height = image.naturalHeight * (1 - border * 2);
        const scale = Math.min(1, 3200 / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round((quarter ? height : width) * scale); canvas.height = Math.round((quarter ? width : height) * scale);
        const context = canvas.getContext("2d"); if (!context) throw new Error("Image processing unavailable");
        context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
        context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 180);
        context.drawImage(image, image.naturalWidth * border, image.naturalHeight * border, width, height, -width * scale / 2, -height * scale / 2, width * scale, height * scale);
        canvas.toBlob((output) => { canvas.width = 0; canvas.height = 0; finish(output ? undefined : new Error("Image conversion failed"), output || undefined); }, "image/jpeg", 0.92);
      } catch (cause) { finish(cause instanceof Error ? cause : new Error("Unable to process photo")); }
    };
    image.src = url;
  });
}
