/** Sayfalar arasında dosya taşımak için küçük bir ara bellek. */
let pending: File[] = [];

export const setPending = (files: File[]): void => {
  pending = files;
};

export const takePending = (): File[] => {
  const files = pending;
  pending = [];
  return files;
};
