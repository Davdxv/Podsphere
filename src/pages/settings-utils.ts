export enum MobileMenuElement {
  Main,
  General,
  Advanced,
}

export interface SettingsPageProps {
  handleImportBackup: (file: File) => Promise<void>;
  handleDownloadBackup: () => Promise<void>;
}

export const standardOptions : { name: string; value: string }[] = [{
  name: 'CORS-Anywhere',
  value: 'https://cors-anywhere.herokuapp.com/',
}, {
  name: 'CORSAnywhere',
  value: 'https://corsanywhere.herokuapp.com/',
}];

export const CustomCorsProxyName = 'custom';

export const CorsProxyStorageKey = 'cors-proxy';

export const getCurrentProxy = () => {
  const currentValue = localStorage.getItem(CorsProxyStorageKey);
  const proxy = standardOptions.find(item => item.value === currentValue);
  if (currentValue) return proxy || { name: CustomCorsProxyName, value: currentValue };
  return standardOptions[0];
};
