export function getImageUrl(localPath: string, isThumb: boolean = false): string {
  const host = process.env.NEXT_PUBLIC_IMAGE_HOST;

  // Resolve the source path: remote DAM URLs are used as-is, local paths get the host prefix
  let resolved = localPath;
  const isRemote = /^https?:\/\//i.test(localPath);
  if (host && localPath.startsWith("/")) {
    resolved = `${host}${localPath}`;
  }

  if (isThumb) {
    // Photon/Jetpack CDN understands ?resize=w,h; bare local paths do not
    // (Next.js image optimization would reject unknown local query strings)
    if (isRemote || host) {
      const sep = resolved.includes("?") ? "&" : "?";
      return `${resolved}${sep}resize=800,800`;
    }
    return localPath.replace(/(\.[^.]+)$/, "-thumb$1");
  }

  return resolved;
}
