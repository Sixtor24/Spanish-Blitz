// @ts-nocheck
import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

type RouteModule = Record<string, unknown>;

const routeModules = import.meta.glob<RouteModule>('../src/app/api/**/route.{js,ts}', {
  eager: true,
});

// Helper function to transform file path to Hono route path
function getHonoPath(routeKey: string): { name: string; pattern: string }[] {
  const relativePath = routeKey.replace('../src/app/api', '');
  const parts = relativePath.split('/').filter(Boolean);
  const routeParts = parts.slice(0, -1); // Remove 'route.js'
  if (routeParts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  const transformedParts = routeParts.map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

async function registerRoutes(modules: Record<string, RouteModule>) {
  api.routes = [];

  const sortedEntries = Object.entries(modules).sort((a, b) => b[0].length - a[0].length);

  for (const [routeKey, route] of sortedEntries) {
    try {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        const handlerFn = (route as Record<string, any>)[method];
        if (!handlerFn) continue;

        const parts = getHonoPath(routeKey);
        const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
        const handler: Handler = async (c) => {
          const params = c.req.param();
          if (import.meta.env.DEV) {
            const freshModules = import.meta.glob<RouteModule>(
              '../src/app/api/**/route.{js,ts}',
              { eager: true }
            );
            const freshRoute = freshModules[routeKey] as Record<string, any>;
            const freshHandler = freshRoute?.[method];
            if (freshHandler) {
              return await freshHandler(c.req.raw, { params });
            }
          }
          return await handlerFn(c.req.raw, { params });
        };

        switch (method.toLowerCase()) {
          case 'get':
            api.get(honoPath, handler);
            break;
          case 'post':
            api.post(honoPath, handler);
            break;
          case 'put':
            api.put(honoPath, handler);
            break;
          case 'delete':
            api.delete(honoPath, handler);
            break;
          case 'patch':
            api.patch(honoPath, handler);
            break;
          default:
            console.warn(`Unsupported method: ${method}`);
            break;
        }
      }
    } catch (error) {
      console.error(`Error registering route ${routeKey}:`, error);
    }
  }
}

await registerRoutes(routeModules);

if (import.meta.hot) {
  import.meta.hot.accept((modules) => {
    registerRoutes((modules as any) ?? routeModules).catch((err) => {
      console.error('Error reloading routes:', err);
    });
  });
}

export { api, API_BASENAME };
