export function getImageUrl(localPath: string, isThumb: boolean = false): string {
  const host = process.env.NEXT_PUBLIC_IMAGE_HOST;
  
  if (host) {
    // We are on Vercel connecting to Jetpack CDN
    if (isThumb) {
      // Jetpack uses ?resize=w,h rather than -thumb in the filename
      return `${host}${localPath}?resize=800,800`;
    }
    // High res from Jetpack
    return `${host}${localPath}`;
  } else {
    // Local dev: use the generated -thumb.jpg file if requested
    if (isThumb) {
      return localPath.replace(/(\.[^.]+)$/, '-thumb$1');
    }
    return localPath;
  }
}
