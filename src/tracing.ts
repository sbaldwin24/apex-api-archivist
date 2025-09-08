import { randomBytes } from 'node:crypto';
import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger('tracing');

export interface Span {
	traceId: string;
	spanId: string;
	parentSpanId?: string | undefined;
	operationName: string;
	startTime: number;
	endTime?: number | undefined;
	duration?: number | undefined;
	tags: Record<string, any>;
	logs: Array<{ timestamp: number; message: string; level: string }>;
	status: 'ok' | 'error' | 'timeout';
}

export class Tracer {
	private spans = new Map<string, Span>();
	private activeSpans = new Map<string, string>(); // contextId -> spanId

	startSpan(
		operationName: string,
		parentSpanId?: string,
		traceId?: string
	): Span {
		const spanId = this.generateId();
		const finalTraceId =
			traceId || parentSpanId
				? this.getTraceId(parentSpanId)
				: this.generateId();

		const span: Span = {
			logs: [],
			operationName,
			parentSpanId,
			spanId,
			startTime: Date.now(),
			status: 'ok',
			tags: {},
			traceId: finalTraceId
		};

		this.spans.set(spanId, span);

		logger.debug('Span started', 'tracing', {
			operationName,
			parentSpanId,
			spanId,
			traceId: finalTraceId
		});

		return span;
	}

	finishSpan(spanId: string, status: 'ok' | 'error' | 'timeout' = 'ok'): void {
		const span = this.spans.get(spanId);

		if (!span) return;

		span.endTime = Date.now();
		span.duration = span.endTime - span.startTime;
		span.status = status;

		logger.info('Span finished', 'tracing', {
			duration: span.duration,
			operationName: span.operationName,
			spanId,
			status,
			traceId: span.traceId
		});

		/** In production, send to tracing backend (Jaeger, Zipkin) */
		this.exportSpan(span);
	}

	addTag(spanId: string, key: string, value: any): void {
		const span = this.spans.get(spanId);

		if (span) {
			span.tags[key] = value;
		}
	}

	addLog(spanId: string, message: string, level: string = 'info'): void {
		const span = this.spans.get(spanId);

		if (span) {
			span.logs.push({
				level,
				message,
				timestamp: Date.now()
			});
		}
	}

	setActiveSpan(contextId: string, spanId: string): void {
		this.activeSpans.set(contextId, spanId);
	}

	getActiveSpan(contextId: string): Span | undefined {
		const spanId = this.activeSpans.get(contextId);

		return spanId ? this.spans.get(spanId) : undefined;
	}

	createChildSpan(contextId: string, operationName: string): Span | null {
		const parentSpan = this.getActiveSpan(contextId);

		if (!parentSpan) return null;

		return this.startSpan(operationName, parentSpan.spanId, parentSpan.traceId);
	}

	private getTraceId(spanId?: string): string {
		if (!spanId) return this.generateId();

		const span = this.spans.get(spanId);

		return span?.traceId || this.generateId();
	}

	private generateId(): string {
		return randomBytes(8).toString('hex');
	}

	private exportSpan(span: Span): void {
		/** In production, export to Jaeger/Zipkin */
		/** For now, just log the trace */
		if (span.duration && span.duration > 1000) {
			logger.warn('Slow operation detected', 'tracing', {
				duration: span.duration,
				operationName: span.operationName,
				traceId: span.traceId
			});
		}
	}

	getTrace(traceId: string): Span[] {
		return Array.from(this.spans.values()).filter(
			(span) => span.traceId === traceId
		);
	}

	getStats(): { totalSpans: number; activeSpans: number; avgDuration: number } {
		const spans = Array.from(this.spans.values());
		const completedSpans = spans.filter((s) => s.duration !== undefined);
		const avgDuration =
			completedSpans.length > 0
				? completedSpans.reduce((sum, s) => sum + (s.duration || 0), 0) /
					completedSpans.length
				: 0;

		return {
			activeSpans: spans.filter((s) => !s.endTime).length,
			avgDuration: Math.round(avgDuration),
			totalSpans: spans.length
		};
	}
}

/** Singleton instance */
export const tracer = new Tracer();

/** Middleware for Express to add tracing */
export function tracingMiddleware(req: any, res: any, next: any): void {
	const traceId =
		req.headers['x-trace-id'] || tracer.startSpan('http_request').traceId;
	const span = tracer.startSpan(
		`${req.method} ${req.path}`,
		undefined,
		traceId
	);

	tracer.addTag(span.spanId, 'http.method', req.method);
	tracer.addTag(span.spanId, 'http.url', req.url);
	tracer.addTag(span.spanId, 'http.user_agent', req.headers['user-agent']);

	req.traceId = traceId;
	req.spanId = span.spanId;

	res.setHeader('X-Trace-Id', traceId);

	const originalEnd = res.end;

	res.end = (...args: any[]) => {
		tracer.addTag(span.spanId, 'http.status_code', res.statusCode);
		tracer.finishSpan(span.spanId, res.statusCode >= 400 ? 'error' : 'ok');
		originalEnd.apply(res, args);
	};

	next();
}
