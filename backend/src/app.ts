import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimit';
import { notFoundHandler } from './middleware/notFoundHandler';
import { apiRouter } from './routes';

export const app = express();

app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'"],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
  }),
);
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize());
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', apiRateLimiter);

if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
