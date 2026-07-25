type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  info(message: string, meta?: Record<string, any>) {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message: string, meta?: Record<string, any>) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message: string, error?: unknown, meta?: Record<string, any>) {
    const errorMeta = error instanceof Error 
      ? { ...meta, errorMessage: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined }
      : meta;
    console.error(this.formatMessage('error', message, errorMeta));
  }

  debug(message: string, meta?: Record<string, any>) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
