import { pool } from './database';

export class DatabaseOptimizer {
	async createOptimizedIndexes(): Promise<void> {
		const indexes = [
			/** Race results performance indexes */
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_race_results_event_id ON race_results(event_id)',
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_race_results_driver_id ON race_results(driver_id)',
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_race_results_finish_position ON race_results(finish_position)',

			/** Events performance indexes */
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_season_id ON events(season_id)',
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_date ON events(event_date)',
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_track_id ON events(track_id)',

			/** Seasons performance indexes */
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seasons_year ON seasons(year)',
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seasons_series_year ON seasons(series_id, year)',

			/** Driver standings indexes */
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_standings_season_race ON driver_standings(season_id, race_number)',
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_standings_driver ON driver_standings(driver_id)',

			/** Composite indexes for common queries */
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_race_results_event_finish ON race_results(event_id, finish_position)',
			'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_season_date ON events(season_id, event_date)'
		];

		for (const indexSql of indexes) {
			try {
				await pool.query(indexSql);

				console.log(`✅ Created index: ${indexSql.split(' ')[5]}`);
			} catch (error: any) {
				if (!error.message.includes('already exists')) {
					console.warn(`⚠️  Index creation failed: ${error.message}`);
				}
			}
		}
	}

	async optimizeQueries(): Promise<void> {
		/** Update table statistics for better query planning */
		const tables = [
			'race_results',
			'events',
			'drivers',
			'teams',
			'tracks',
			'seasons',
			'series'
		];

		for (const table of tables) {
			try {
				await pool.query(`ANALYZE ${table}`);

				console.log(`📊 Analyzed table: ${table}`);
			} catch (error: any) {
				console.warn(`⚠️  Analysis failed for ${table}: ${error.message}`);
			}
		}
	}

	async getPerformanceStats(): Promise<any> {
		try {
			const result = await pool.query(`
				SELECT 
					schemaname,
					tablename,
					attname,
					n_distinct,
					correlation
				FROM pg_stats 
				WHERE schemaname = 'public' 
				AND tablename IN ('race_results', 'events', 'drivers')
				ORDER BY tablename, attname
			`);

			return result.rows;
		} catch (error) {
			console.error('Failed to get performance stats:', error);

			return [];
		}
	}

	async setupConnectionPooling(): Promise<void> {
		/** Optimize pool settings */
		pool.options.max = 20; // Maximum connections
		pool.options.idleTimeoutMillis = 30000; // 30 seconds
		pool.options.connectionTimeoutMillis = 2000; // 2 seconds

		console.log('🔧 Optimized connection pool settings');
	}
}
