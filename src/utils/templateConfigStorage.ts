import type { TemplateConfig } from 'src/components/template-editor/field-types';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = <T>(value: string | null): T | undefined => {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn('[templateConfigStorage] Failed to parse config from storage.', error);
    return undefined;
  }
};

export const saveConfig = (key: string, config: TemplateConfig): void => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(config));
  } catch (error) {
    console.warn('[templateConfigStorage] Could not save config to storage.', error);
  }
};

export const loadConfig = (key: string): TemplateConfig | undefined => {
  if (!isBrowser) return undefined;
  try {
    const value = window.localStorage.getItem(key);
    return safeParse<TemplateConfig>(value);
  } catch (error) {
    console.warn('[templateConfigStorage] Could not load config from storage.', error);
    return undefined;
  }
};

export interface UploadConfigResponse {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

export const uploadConfig = async (
  apiUrl: string,
  config: TemplateConfig,
): Promise<UploadConfigResponse | undefined> => {
  if (!apiUrl) {
    console.warn('[templateConfigStorage] Missing apiUrl for upload.');
    return undefined;
  }

  if (typeof fetch !== 'function') {
    console.warn('[templateConfigStorage] Fetch API unavailable in this environment.');
    return undefined;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    console.warn('[templateConfigStorage] Upload failed.', response.status, response.statusText);
    return undefined;
  }

  try {
    const payload = (await response.json()) as UploadConfigResponse;
    return payload;
  } catch (error) {
    console.warn('[templateConfigStorage] Could not parse upload response.', error);
    return undefined;
  }
};
