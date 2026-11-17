// A versão vem do package.json (injetada pelo Vite em vite.config.ts): uma só fonte.
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const APP_VERSION_LABEL = `v${APP_VERSION.replace(/\.0$/, '')}`;
