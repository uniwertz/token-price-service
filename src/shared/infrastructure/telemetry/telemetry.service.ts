import { Injectable, Logger } from "@nestjs/common";

export interface MetricPoint {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private traceId: string = this.generateId();
  private spanId: string = this.generateId();

  startSpan(name: string, parentSpanId?: string): SpanContext {
    const spanId = this.generateId();
    return {
      traceId: this.traceId,
      spanId,
      parentSpanId,
    };
  }

  recordMetric(metric: MetricPoint): void {
    // Отправка метрик в систему мониторинга
    this.logger.debug("Metric recorded", {
      type: "metric",
      timestamp: new Date().toISOString(),
      ...metric,
    });
  }

  recordSpan(
    span: SpanContext,
    name: string,
    duration: number,
    success: boolean
  ): void {
    // Отправка трейсов в систему трассировки
    this.logger.debug("Span recorded", {
      type: "span",
      timestamp: new Date().toISOString(),
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name,
      duration,
      success,
    });
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
