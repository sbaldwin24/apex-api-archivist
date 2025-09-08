import { EventEmitter } from 'events';
import { StructuredLogger } from './structured-logger';

const logger = new StructuredLogger('queue');

export interface QueueMessage {
	id: string;
	type: 'scrape_race' | 'scrape_driver' | 'process_data' | 'send_notification';
	payload: any;
	priority: number;
	retries: number;
	maxRetries: number;
	createdAt: string;
	processAfter?: string;
}

export class MessageQueue extends EventEmitter {
	private queues = new Map<string, QueueMessage[]>();
	private processing = new Set<string>();
	private workers = new Map<string, number>();

	constructor() {
		super();
		this.setupQueues();
	}

	private setupQueues(): void {
		/** Initialize priority queues */
		this.queues.set('high', []);
		this.queues.set('normal', []);
		this.queues.set('low', []);

		/** Set worker counts per queue */
		this.workers.set('high', 3);
		this.workers.set('normal', 2);
		this.workers.set('low', 1);
	}

	async publish(
		message: Omit<QueueMessage, 'id' | 'createdAt'>
	): Promise<string> {
		const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const fullMessage: QueueMessage = {
			...message,
			createdAt: new Date().toISOString(),
			id,
			retries: 0
		};

		const queueName = this.getQueueByPriority(message.priority);
		this.queues.get(queueName)!.push(fullMessage);

		/** Sort by priority within queue */
		this.queues.get(queueName)!.sort((a, b) => b.priority - a.priority);

		logger.info('Message published', 'queue', {
			messageId: id,
			queue: queueName,
			queueSize: this.queues.get(queueName)!.length,
			type: message.type
		});

		this.emit('message', queueName);

		return id;
	}

	async consume(
		queueName: string,
		handler: (message: QueueMessage) => Promise<void>
	): Promise<void> {
		const queue = this.queues.get(queueName);

		if (!queue) return;

		while (queue.length > 0) {
			const message = queue.shift();

			if (!message) continue;

			/** Check if message should be delayed */
			if (message.processAfter && new Date(message.processAfter) > new Date()) {
				queue.push(message); // Put back for later

				continue;
			}

			const processingKey = `${queueName}:${message.id}`;

			if (this.processing.has(processingKey)) continue;

			this.processing.add(processingKey);

			try {
				logger.debug('Processing message', 'queue', {
					attempt: message.retries + 1,
					messageId: message.id,
					type: message.type
				});

				await handler(message);

				logger.info('Message processed successfully', 'queue', {
					messageId: message.id,
					type: message.type
				});
			} catch (error) {
				message.retries++;

				if (message.retries < message.maxRetries) {
					/** Exponential backoff */
					const delay = Math.min(1000 * 2 ** message.retries, 30000);

					message.processAfter = new Date(Date.now() + delay).toISOString();

					queue.push(message); // Retry later

					logger.warn('Message failed, will retry', 'queue', {
						attempt: message.retries,
						error: (error as Error).message,
						messageId: message.id,
						retryAfter: message.processAfter
					});
				} else {
					logger.error('Message failed permanently', 'queue', {
						error: (error as Error).message,
						messageId: message.id,
						totalAttempts: message.retries
					});

					/** Send to dead letter queue */
					await this.publish({
						maxRetries: 1,
						payload: {
							error: (error as Error).message,
							originalMessage: message,
							type: 'dead_letter'
						},
						priority: 1,
						retries: 0,
						type: 'send_notification'
					});
				}
			} finally {
				this.processing.delete(processingKey);
			}
		}
	}

	startWorkers(): void {
		for (const [queueName, workerCount] of this.workers) {
			for (let i = 0; i < workerCount; i++) {
				this.startWorker(queueName, i);
			}
		}

		logger.info('Message queue workers started', 'queue', {
			workers: Object.fromEntries(this.workers)
		});
	}

	private startWorker(queueName: string, workerId: number): void {
		const processQueue = async () => {
			await this.consume(queueName, async (message) => {
				/** Emit event for handlers to process */
				this.emit(`process:${message.type}`, message);
			});
		};

		/** Process immediately and then every 5 seconds */
		processQueue();
		setInterval(processQueue, 5000);

		logger.debug('Worker started', 'queue', { queueName, workerId });
	}

	private getQueueByPriority(priority: number): string {
		if (priority >= 8) return 'high';
		if (priority >= 5) return 'normal';
		return 'low';
	}

	getStats(): any {
		const stats: any = {};

		for (const [queueName, queue] of this.queues) {
			stats[queueName] = {
				processing: Array.from(this.processing).filter((key) =>
					key.startsWith(queueName)
				).length,
				size: queue.length,
				workers: this.workers.get(queueName) || 0
			};
		}

		return stats;
	}
}

/** Singleton instance */
export const messageQueue = new MessageQueue();
