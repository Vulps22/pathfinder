import { Express, Request, Response } from 'express';
import { readdirSync } from 'fs';
import { join, relative } from 'path';
import { ApiRoute } from '../types/ApiRoute';

interface RegisteredRoute {
  urlPath: string;
  filePath: string;
  dynamicSegments: number;
}

export function toUrlPath(relativePath: string): string {
  const urlSegment = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => segment.replace(/^\[(.+)\]$/, ':$1'))
    .join('/');

  return '/' + urlSegment.replace(/\/index$/, '').replace(/^index$/, '');
}

export function sortRoutes(routes: RegisteredRoute[]): RegisteredRoute[] {
  return [...routes].sort((a, b) => {
    if (a.dynamicSegments !== b.dynamicSegments) return a.dynamicSegments - b.dynamicSegments;
    // When dynamic segment count is equal, the route whose first dynamic segment
    // appears later is more specific and must be registered first.
    // e.g. /question/random before /question/:id
    const firstDynA = a.urlPath.split('/').findIndex(s => s.startsWith(':'));
    const firstDynB = b.urlPath.split('/').findIndex(s => s.startsWith(':'));
    return firstDynB - firstDynA;
  });
}

function collectRoutes(dirPath: string, basePath: string): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  const items = readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = join(dirPath, item.name);

    if (item.isDirectory()) {
      routes.push(...collectRoutes(itemPath, basePath));
    } else if (item.isFile() && item.name.endsWith('.js')) {
      const relativePath = relative(basePath, itemPath).replace(/\.js$/, '');
      const urlPath = toUrlPath(relativePath);
      const dynamicSegments = (urlPath.match(/:/g) ?? []).length;
      routes.push({ urlPath, filePath: itemPath, dynamicSegments });
    }
  }

  return routes;
}

export async function loadRoutes(app: Express, routesPath: string): Promise<void> {
  const sorted = sortRoutes(collectRoutes(routesPath, routesPath));

  for (const { urlPath, filePath } of sorted) {
    const routeModule = await import(filePath) as { route: ApiRoute };
    const route = routeModule.route;
    const middleware = route.middleware ?? [];

    if (route.get)    app.get(urlPath,    ...middleware, (req: Request, res: Response) => void route.get!(req, res));
    if (route.post)   app.post(urlPath,   ...middleware, (req: Request, res: Response) => void route.post!(req, res));
    if (route.put)    app.put(urlPath,    ...middleware, (req: Request, res: Response) => void route.put!(req, res));
    if (route.patch)  app.patch(urlPath,  ...middleware, (req: Request, res: Response) => void route.patch!(req, res));
    if (route.delete) app.delete(urlPath, ...middleware, (req: Request, res: Response) => void route.delete!(req, res));

    console.log(`[Router] Registered: ${urlPath}`);
  }
}
