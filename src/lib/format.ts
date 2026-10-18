/**
 * Sunucu kotası değil, tarayıcı belleği koruması: pdf-lib dosyayı bellekte
 * açıp yeniden yazar, yani tepe kullanım dosya boyutunun birkaç katıdır.
 */
export const MAX_BYTES = 300 * 1024 * 1024;

export const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};
