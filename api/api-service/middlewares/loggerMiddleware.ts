import winston from 'winston';
import morgan from 'morgan';

export default function useLogger () {
  // Create Winston logger
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/app.log' })
    ]
  });

  // Create Morgan stream to pipe HTTP logs to Winston
  const morganStream = {
    write: (message: string) => {
      logger.http(message.trim());
    }
  };

  // Use Morgan with Winston stream
  return morgan('combined', { stream: morganStream });
}