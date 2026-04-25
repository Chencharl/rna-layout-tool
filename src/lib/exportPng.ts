import { slugifyTitle } from "./projectIO";

export async function exportSvgMarkupToPng(
  svgMarkup: string,
  filenameTitle: string,
  width: number,
  height: number,
  transparent = true,
): Promise<void> {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not render SVG as an image."));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    URL.revokeObjectURL(url);
    throw new Error("Canvas rendering is not available in this browser.");
  }

  if (!transparent) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);
  URL.revokeObjectURL(url);

  const pngBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!pngBlob) {
    throw new Error("PNG export failed.");
  }

  const pngUrl = URL.createObjectURL(pngBlob);
  const anchor = document.createElement("a");
  anchor.href = pngUrl;
  anchor.download = `${slugifyTitle(filenameTitle)}.png`;
  anchor.click();
  URL.revokeObjectURL(pngUrl);
}
