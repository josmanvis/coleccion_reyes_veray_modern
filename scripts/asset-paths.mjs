export function canonicalPath(input) {
 if (typeof input === "string" && input.startsWith("https://i0.wp.com/coleccionreyesveray.com../wp-content/")) input = input.replace("coleccionreyesveray.com../wp-content/", "coleccionreyesveray.com/wp-content/");
 if (typeof input !== 'string' || /\\|%2f|%5c|(?:^|\/)(?:\.{1,2}|%2e(?:%2e)?)(?:\/|$)/i.test(input)) return null;
 let path;
 try {
  if (input.startsWith('/')) path = input.split('?')[0];
  else {
   const url = new URL(input);
   if (['coleccionreyesveray.com','www.coleccionreyesveray.com'].includes(url.hostname)) path = url.pathname;
   else if (/^i[0-3]\.wp\.com$/.test(url.hostname) && url.pathname.startsWith('/coleccionreyesveray.com/')) path = url.pathname.slice('/coleccionreyesveray.com'.length);
   else return null;
  }
  path = decodeURIComponent(path);
 } catch { return null; }
 if (!path.startsWith('/wp-content/') || path.split('/').some(part => part === '..' || part === '.') || /[\\\x00-\x1f]/.test(path)) return null;
 return path;
}
export function variantPath(path, width) { return `${path}.w${width}.webp`; }
