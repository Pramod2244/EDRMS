export {};
self.onmessage = async (event: MessageEvent<{ blob: Blob; rotation: number; crop: boolean }>) => {
  let image: ImageBitmap | undefined;
  try {
    const { blob, rotation, crop } = event.data;
    image = await createImageBitmap(blob);
    if (image.width * image.height > 80_000_000) throw new Error("Photo is too large. Choose a lower-resolution photo.");
    const border = crop ? 0.05 : 0;
    const width = image.width * (1 - border * 2), height = image.height * (1 - border * 2);
    const scale = Math.min(1, 3200 / Math.max(width, height));
    const quarter = rotation % 180 !== 0;
    const canvas = new OffscreenCanvas(Math.round((quarter ? height : width) * scale), Math.round((quarter ? width : height) * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing unavailable");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 180);
    context.drawImage(image, image.width * border, image.height * border, width, height, -width * scale / 2, -height * scale / 2, width * scale, height * scale);
    const output = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
    self.postMessage({ blob: output });
  } catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "Unable to process photo", fallback: cause instanceof DOMException && cause.name === "InvalidStateError" }); }
  finally { image?.close(); }
};
