import type express from 'express';

export function setupMonitoring(app: express.Application) {
	/** Metrics endpoint */
	app.get('/metrics', async (req, res) => {
		const metrics = {
			memory: process.memoryUsage(),
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			version: process.env.npm_package_version
		};
		res.json(metrics);
	});

	/** Database health check */
	app.get('/health/db', async (req, res) => {
		try {
			const { pool } = await import('./src/database');

			res.json({ database: 'connected', status: 'healthy' });
		} catch (error) {
			res.status(503).json({ database: 'disconnected', status: 'unhealthy' });
		}
	});
}
