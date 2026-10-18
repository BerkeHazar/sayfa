/**
 * Görünüm değişiminde temizlik.
 * Router yeni bir ekran basmadan önce `disposeAll()` çağırır; her ekran
 * kendi temizliğini `onDispose` ile kaydeder. Böylece pdf.js worker'ı,
 * pencere dinleyicileri ve önbellekler ekranla birlikte gider.
 */
type Disposer = () => void;

let disposers: Disposer[] = [];

export function onDispose(fn: Disposer): void {
  disposers.push(fn);
}

export function disposeAll(): void {
  for (const fn of disposers) {
    try {
      fn();
    } catch {
      /* temizlik hatası görünümü engellemesin */
    }
  }
  disposers = [];
}
