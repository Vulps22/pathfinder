import { Request, Response, RequestHandler } from 'express';

export type Middleware = RequestHandler;

export interface ApiRoute {
  middleware?: Middleware[];
  get?:    (req: Request, res: Response) => Promise<void>;
  post?:   (req: Request, res: Response) => Promise<void>;
  put?:    (req: Request, res: Response) => Promise<void>;
  patch?:  (req: Request, res: Response) => Promise<void>;
  delete?: (req: Request, res: Response) => Promise<void>;
}

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteInfo {
  path:    string;        // Express path, e.g. /api/v1/item/:id
  methods: RouteMethod[]; // methods the route file defines
  file:    string;        // route file, relative to routesPath
}
