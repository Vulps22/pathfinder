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
