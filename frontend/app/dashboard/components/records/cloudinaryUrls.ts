export function normalizeCloudinaryUrl(url: string) {
  return url
    .replace('/upload/fl_inline/', '/upload/')
    .replace('/upload/fl_attachment/', '/upload/');
}

export function cloudinaryFlag(url: string, flag: string) {
  const normalizedUrl = normalizeCloudinaryUrl(url);
  return normalizedUrl.includes('/upload/') ? normalizedUrl.replace('/upload/', `/upload/${flag}/`) : normalizedUrl;
}

export function cloudinaryPdfPreview(url: string) {
  const normalizedUrl = normalizeCloudinaryUrl(url);
  return normalizedUrl.includes('/image/upload/')
    ? normalizedUrl.replace('/image/upload/', '/image/upload/pg_1,f_jpg/')
    : normalizedUrl;
}
