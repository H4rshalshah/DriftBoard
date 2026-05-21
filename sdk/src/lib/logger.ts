import { Logger } from '../types';

export class DebugLogger implements Logger {
  private enabled: boolean;
  private prefix: string = '[DriftBoard]';

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  private formatMessage(level: string, message: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ') : '';
    return `${timestamp} ${this.prefix} [${level}] ${message}${formattedArgs}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.debug(this.formatMessage('DEBUG', message, args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.info(this.formatMessage('INFO', message, args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.warn(this.formatMessage('WARN', message, args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.enabled) {
      console.error(this.formatMessage('ERROR', message, args));
    }
  }
}

export function createLogger(debug: boolean = false): Logger {
  return new DebugLogger(debug);
}