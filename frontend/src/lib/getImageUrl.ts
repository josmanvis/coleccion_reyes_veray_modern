export function getImageUrl(localPath: string, isThumb: boolean = false): string {
  const host = process.env.NEXT_PUBLIC_IMAGE_HOST;

  // Resolve the source path: remote DAM URLs are used as-is, local paths get the host prefix
  let resolved = localPath;
  if (host && localPath.startsWith("/")) {
    resolved = `${host}${localPath}`;
  }

  if (isThumb) {
    // Jetpack CDN uses ?resize=w,h; append correctly whether the URL already has a query string
    const sep = resolved.includes("?") ? "&" : "?";
    return `${resolved}${sep}resize=800,800`;
  }

  return resolved;
}
