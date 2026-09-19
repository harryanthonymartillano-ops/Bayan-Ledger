import winston from 'winston';
import { config } from 'dotenv';

config();

const logLevel = process.env.LOG_LEVEL || 'info';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      process.env.NODE_ENV === 'production' ? winston.format.uncolorize() : winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} [${level}]: ${message}`;
      })
    ),
  }),
];

if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'bayan-ledger-api' },
  transports,
});

export default logger;
