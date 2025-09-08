import { pool } from './database';

export async function getSponsorDashboard(sponsorId: string) {
	const client = await pool.connect();
	try {
		/** Get sponsor overview */
		const sponsorResult = await client.query(
			'SELECT * FROM sponsors WHERE id = $1',
			[sponsorId]
		);
		const sponsor = sponsorResult.rows[0];

		/** Get active partnerships */
		const partnershipsResult = await client.query(
			`
      SELECT sp.*, t.name as team_name, d.first_name, d.last_name
      FROM sponsor_partnerships sp
      LEFT JOIN teams t ON sp.team_id = t.id
      LEFT JOIN drivers d ON sp.driver_id = d.id
      WHERE sp.sponsor_id = $1 AND sp.status = 'active'
    `,
			[sponsorId]
		);

		/** Get recent exposures */
		const exposuresResult = await client.query(
			`
      SELECT be.*, e.name as event_name, e.event_date
      FROM brand_exposures be
      JOIN events e ON be.event_id = e.id
      WHERE be.sponsor_id = $1
      ORDER BY be.recorded_at DESC
      LIMIT 10
    `,
			[sponsorId]
		);

		/** Get monthly impression trends */
		const trendsResult = await client.query(
			`
      SELECT 
        DATE_TRUNC('month', e.event_date) as month,
        SUM(be.estimated_impressions) as impressions,
        AVG(be.engagement_score) as avg_engagement
      FROM brand_exposures be
      JOIN events e ON be.event_id = e.id
      WHERE be.sponsor_id = $1
      GROUP BY DATE_TRUNC('month', e.event_date)
      ORDER BY month DESC
      LIMIT 12
    `,
			[sponsorId]
		);

		return {
			monthly_trends: trendsResult.rows,
			partnerships: partnershipsResult.rows,
			recent_exposures: exposuresResult.rows,
			sponsor
		};
	} finally {
		client.release();
	}
}

export async function getTopSponsors(limit = 10) {
	const client = await pool.connect();

	try {
		const result = await client.query(
			`
      SELECT 
        s.id, s.name,
        SUM(be.estimated_impressions) as total_impressions,
        COUNT(DISTINCT be.event_id) as events_count,
        AVG(be.engagement_score) as avg_engagement
      FROM sponsors s
      JOIN brand_exposures be ON s.id = be.sponsor_id
      JOIN events e ON be.event_id = e.id
      WHERE e.event_date >= CURRENT_DATE - INTERVAL '1 year'
      GROUP BY s.id, s.name
      ORDER BY total_impressions DESC
      LIMIT $1
    `,
			[limit]
		);

		return result.rows;
	} finally {
		client.release();
	}
}
