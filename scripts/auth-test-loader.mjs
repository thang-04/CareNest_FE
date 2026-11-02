import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const environmentUrl = pathToFileURL(path.join(sourceRoot, 'config', 'env.js')).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let target = path.join(sourceRoot, specifier.slice(2));
    if (!path.extname(target)) target += '.js';
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const target = new URL(specifier, context.parentURL);
    if (!path.extname(fileURLToPath(target)) && existsSync(fileURLToPath(target) + '.js')) {
      return { url: target.href + '.js', shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === environmentUrl) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `export const API_BASE_URL = 'http://auth.test/api';
        export const AUTH_MODE = process.env.CARENEST_TEST_AUTH_MODE || 'gateway';
        export const AUTH_USE_MOCK = AUTH_MODE === 'mock';
        export const USE_MOCK = true;
        export const MOCK_LATENCY_MS = 0;
        export const SCHOOL_CONFIG_API = false;
        export const KEYCLOAK_DEV_LOGIN = false;
        export const DEV_SKIP_YEAR_DATES = false;
        export const DEV_BE_BASE_URL = '/be-api';
        export const DEV_KEYCLOAK_URL = '/kc';
        export const DEV_KEYCLOAK_REALM = 'carenest';
        export const DEV_KEYCLOAK_CLIENT = 'carenest-dev';
        export const DEV_KEYCLOAK_PASSWORD = '';`,
    };
  }
  return nextLoad(url, context);
}
