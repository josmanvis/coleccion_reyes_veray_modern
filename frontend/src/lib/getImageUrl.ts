/** Asset origins are resolved on the server; responsive sizes use image-loader. */
export function getImageUrl(path: string, _isThumb = false): string {
  void _isThumb;
  if (path.startsWith("https://storage.googleapis.com/")) return path.split("?")[0];
  return path;
}
