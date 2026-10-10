/**
 * Client-side image compressor.
 * Converts images to WebP format with max dimensions and quality target.
 * Per INV-NET-03: target ≤100KB WebP.
 */
export async function compressImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxSizeKB?: number;
  } = {}
): Promise<Blob> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.75,
    maxSizeKB = 100,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Could not create canvas context"));
      return;
    }

    img.onload = () => {
      // Calculate scaled dimensions maintaining aspect ratio
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Try progressively lower quality if needed
      let currentQuality = quality;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Compression failed"));
              return;
            }
            // If the blob is still too large and quality can be reduced
            if (blob.size > maxSizeKB * 1024 && currentQuality > 0.3) {
              currentQuality -= 0.1;
              tryCompress();
            } else {
              resolve(blob);
            }
          },
          "image/webp",
          currentQuality
        );
      };
      tryCompress();
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
