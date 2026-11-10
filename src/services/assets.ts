export const appAssetUrl = (assetPath: string): string => {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(assetPath)) return assetPath;

  const baseUrl = import.meta.env.BASE_URL;
  if (assetPath.startsWith(baseUrl)) return assetPath;
  return `${baseUrl}${assetPath.replace(/^\/+/, '')}`;
};

export const DEFAULT_BUS_MAP_IMAGE =
  'assets/aistudio/WhatsApp_Image_2026-10-20_at_4.19.25_PM_4a42e03a.jpeg';
