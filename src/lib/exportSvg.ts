import { slugifyTitle } from "./projectIO";

export function createStandaloneSvgMarkup(svgElement: SVGSVGElement, title: string): string {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  const viewBox = clone.getAttribute("viewBox");

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  if (viewBox) {
    const [, , width, height] = viewBox.split(/\s+/).map(Number);
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
  }

  if (!clone.querySelector("title")) {
    const titleNode = document.createElementNS("http://www.w3.org/2000/svg", "title");
    titleNode.textContent = title;
    clone.prepend(titleNode);
  }

  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(clone)}`;
}

export function getSvgFilename(title: string): string {
  return `${slugifyTitle(title)}.svg`;
}
