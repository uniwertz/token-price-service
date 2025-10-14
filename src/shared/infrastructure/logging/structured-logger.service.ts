import { Injectable, LoggerService } from "@nestjs/common";

export interface LogContext {
  [key: string]: any;
}

@Injectable()
export class StructuredLoggerService implements LoggerService {
  private context?: string;

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: LogContext) {
    this.writeLog("info", message, context);
  }

  error(message: string, trace?: string, context?: LogContext) {
    this.writeLog("error", message, { ...context, trace });
  }

  warn(message: string, context?: LogContext) {
    this.writeLog("warn", message, context);
  }

  debug(message: string, context?: LogContext) {
    this.writeLog("debug", message, context);
  }

  verbose(message: string, context?: LogContext) {
    this.writeLog("verbose", message, context);
  }

  private writeLog(level: string, message: string, context?: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...context,
    };

    // Используем process.stdout.write для production-ready логирования
    // Это избегает блокировки EventLoop и обеспечивает лучшую производительность
    process.stdout.write(JSON.stringify(logEntry) + "\n");
  }
}
