import fs from 'fs';
import path from 'path';

interface SessionState {
	sessionId: string;
	startTime: string;
	completedUrls: string[];
	failedUrls: string[];
	totalQueued: number;
	lastUpdate: string;
}

export class SessionManager {
	private sessionFile: string;
	private state: SessionState;

	constructor(sessionId?: string) {
		this.sessionFile = path.join(
			process.cwd(),
			'sessions',
			`${sessionId || this.generateSessionId()}.json`
		);

		this.state = this.loadSession();
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private loadSession(): SessionState {
		try {
			if (fs.existsSync(this.sessionFile)) {
				return JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
			}
		} catch (error) {
			console.warn(`Failed to load session, starting fresh --> ${error}`);
		}

		return {
			completedUrls: [],
			failedUrls: [],
			lastUpdate: new Date().toISOString(),
			sessionId: this.generateSessionId(),
			startTime: new Date().toISOString(),
			totalQueued: 0
		};
	}

	saveSession(): void {
		try {
			const dir = path.dirname(this.sessionFile);

			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			this.state.lastUpdate = new Date().toISOString();

			fs.writeFileSync(this.sessionFile, JSON.stringify(this.state, null, 2));
		} catch (error) {
			console.error(`Failed to save session: ${error}`);
		}
	}

	markCompleted(url: string): void {
		if (!this.state.completedUrls.includes(url)) {
			this.state.completedUrls.push(url);

			this.saveSession();
		}
	}

	markFailed(url: string): void {
		if (!this.state.failedUrls.includes(url)) {
			this.state.failedUrls.push(url);

			this.saveSession();
		}
	}

	isCompleted(url: string): boolean {
		return this.state.completedUrls.includes(url);
	}

	setTotalQueued(total: number): void {
		this.state.totalQueued = total;

		this.saveSession();
	}

	getProgress(): {
		completed: number;
		failed: number;
		total: number;
		percentage: number;
	} {
		const completed = this.state.completedUrls.length;
		const failed = this.state.failedUrls.length;
		const total = this.state.totalQueued;
		const percentage =
			total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

		return { completed, failed, percentage, total };
	}

	getSessionId(): string {
		return this.state.sessionId;
	}
}
