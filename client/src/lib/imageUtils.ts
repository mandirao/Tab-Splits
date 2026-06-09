export async function compressForStorage(dataUrl: string, maxWidth = 1200, quality = 0.65): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function trySessionStore(key: string, dataUrl: string): void {
  const attempts: [number, number][] = [[1200, 0.65], [900, 0.5], [600, 0.35]];
  const run = async (idx: number) => {
    if (idx >= attempts.length) return;
    const [maxW, q] = attempts[idx];
    const compressed = await compressForStorage(dataUrl, maxW, q);
    try {
      sessionStorage.setItem(key, compressed);
    } catch {
      run(idx + 1);
    }
  };
  run(0);
}
