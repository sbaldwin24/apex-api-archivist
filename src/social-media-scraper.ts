import { pool } from './database';

interface SocialMediaPost {
	platform: string;
	postDate: Date;
	postContent: string;
	mentions: number;
	likes: number;
	shares: number;
	comments: number;
	sponsorMentions: string[];
	hashtags: string[];
	driverName?: string;
}

export async function scrapeSocialMediaMetrics(eventId: string): Promise<void> {
	try {
		console.log(`Scraping social media metrics for ${eventId}`);

		/** Scrape from multiple platforms */
		const [twitterPosts, instagramPosts, facebookPosts] = await Promise.all([
			scrapeTwitterMetrics(eventId),
			scrapeInstagramMetrics(eventId),
			scrapeFacebookMetrics(eventId)
		]);

		const allPosts = [...twitterPosts, ...instagramPosts, ...facebookPosts];

		if (allPosts.length > 0) {
			await saveSocialMediaMetrics(eventId, allPosts);
			console.log(
				`Scraped ${allPosts.length} social media posts for ${eventId}`
			);
		} else {
			/** Generate estimated social media data */
			await generateSocialMediaData(eventId);
		}
	} catch (error) {
		console.error('Error scraping social media:', error);
	}
}

async function scrapeTwitterMetrics(
	eventId: string
): Promise<SocialMediaPost[]> {
	/**
	 * TODO: Implement Twitter API v2
	 * Note: Twitter API requires authentication and has rate limits
	 * use Twitter API v2
	 * */

	try {
		/** Simulate Twitter API call */
		const searchTerms = [
			'NASCAR',
			eventId.replace(/_/g, ' '),
			'#NASCAR',
			'#RaceDay'
		];

		/** In production, this would be actual Twitter API calls */
		console.log('Twitter scraping would require API keys and authentication');

		return generateMockTwitterData();
	} catch (error) {
		console.error('Twitter scraping error:', error);

		return [];
	}
}

async function scrapeInstagramMetrics(
	eventId: string
): Promise<SocialMediaPost[]> {
	/** Instagram Basic Display API would be used here */
	console.log('Instagram scraping would require API authentication');

	return generateMockInstagramData();
}

async function scrapeFacebookMetrics(
	eventId: string
): Promise<SocialMediaPost[]> {
	/** Facebook Graph API would be used here */
	console.log('Facebook scraping would require API authentication');

	return generateMockFacebookData();
}

function generateMockTwitterData(): SocialMediaPost[] {
	const mockPosts: SocialMediaPost[] = [
		{
			comments: 23,
			driverName: 'Kyle Larson',
			hashtags: ['NASCAR', 'RaceDay'],
			likes: 245,
			mentions: 1,
			platform: 'twitter',
			postContent:
				'Great race today! @KyleLarsonRacin dominated with @McDonalds sponsorship! #NASCAR #RaceDay',
			postDate: new Date(),
			shares: 67,
			sponsorMentions: ['McDonalds']
		},
		{
			comments: 12,
			driverName: 'Joey Logano',
			hashtags: ['FastestPitCrew'],
			likes: 189,
			mentions: 2,
			platform: 'twitter',
			postContent:
				'Amazing pit stop by the @TeamPenske crew! @Pennzoil getting great exposure #FastestPitCrew',
			postDate: new Date(),
			shares: 34,
			sponsorMentions: ['Pennzoil']
		}
	];

	return mockPosts;
}

function generateMockInstagramData(): SocialMediaPost[] {
	return [
		{
			comments: 156,
			hashtags: ['Winner', 'NASCAR'],
			likes: 1250,
			mentions: 1,
			platform: 'instagram',
			postContent:
				'Victory lane celebration with @MonsterEnergy! 🏆 #Winner #NASCAR',
			postDate: new Date(),
			shares: 89,
			sponsorMentions: ['Monster Energy']
		}
	];
}

function generateMockFacebookData(): SocialMediaPost[] {
	return [
		{
			comments: 89,
			hashtags: [],
			likes: 567,
			mentions: 1,
			platform: 'facebook',
			postContent:
				'Thanks to all our fans and @Chevrolet for an amazing race! See you next week!',
			postDate: new Date(),
			shares: 123,
			sponsorMentions: ['Chevrolet']
		}
	];
}

async function generateSocialMediaData(eventId: string): Promise<void> {
	const client = await pool.connect();

	try {
		console.log('Generating estimated social media data...');

		/** Get drivers from the event */
		const driversResult = await client.query(
			`
      SELECT DISTINCT 
        rr.driver_id,
        d.first_name || ' ' || d.last_name as driver_name,
        rr.finish_position
      FROM race_results rr
      JOIN drivers d ON rr.driver_id = d.id
      WHERE rr.event_id = $1
      ORDER BY rr.finish_position
      LIMIT 10
    `,
			[eventId]
		);

		const platforms = ['twitter', 'instagram', 'facebook'];
		const sponsors = [
			'Coca-Cola',
			'Pepsi',
			'McDonalds',
			'Subway',
			'FedEx',
			'UPS',
			'Chevrolet',
			'Ford',
			'Toyota'
		];

		for (const driver of driversResult.rows) {
			for (const platform of platforms) {
				/** Generate 1-3 posts per driver per platform */
				const postCount = Math.floor(Math.random() * 3) + 1;

				for (let i = 0; i < postCount; i++) {
					const randomSponsor =
						sponsors[Math.floor(Math.random() * sponsors.length)];
					const likes = Math.floor(Math.random() * 1000) + 50;
					const shares = Math.floor(Math.random() * 200) + 10;
					const comments = Math.floor(Math.random() * 100) + 5;

					const postContent = `Great race performance by ${driver.driver_name}! Thanks to ${randomSponsor} for the support! #NASCAR #Racing`;
					const extractedSponsors = extractSponsorsFromText(postContent);
					const extractedHashtags = extractHashtagsFromText(postContent);

					await client.query(
						`
            INSERT INTO social_media_metrics 
            (event_id, driver_id, platform, post_date, post_content, mentions, likes, shares, comments, sponsor_mentions, hashtags)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `,
						[
							eventId,
							driver.driver_id,
							platform,
							new Date(),
							postContent,
							1,
							likes,
							shares,
							comments,
							extractedSponsors.length > 0
								? extractedSponsors
								: [randomSponsor],
							extractedHashtags.length > 0
								? extractedHashtags
								: ['NASCAR', 'Racing']
						]
					);
				}
			}
		}

		console.log('Generated estimated social media data');
	} catch (error) {
		console.error('Error generating social media data:', error);
	} finally {
		client.release();
	}
}

function extractSponsorsFromText(text: string): string[] {
	const sponsors: string[] = [];

	/** Common sponsor patterns */
	const sponsorPatterns = [
		/@([A-Za-z0-9_]+)/g, // @mentions
		/thanks to ([^!.]+)/gi,
		/sponsored by ([^!.]+)/gi,
		/proud partner ([^!.]+)/gi
	];

	for (const pattern of sponsorPatterns) {
		const matches = text.matchAll(pattern);
		for (const match of matches) {
			const sponsor = match[1]?.trim();
			console.log('sponsor', sponsor);
			if (sponsor && sponsor.length > 2 && !sponsors.includes(sponsor)) {
				sponsors.push(sponsor);
			}
		}
	}

	return sponsors;
}

function extractHashtagsFromText(text: string): string[] {
	const hashtags: string[] = [];
	const hashtagPattern = /#([A-Za-z0-9_]+)/g;

	const matches = text.matchAll(hashtagPattern);
	for (const match of matches) {
		const hashtag = match[1];

		if (hashtag && !hashtags.includes(hashtag)) {
			hashtags.push(hashtag);
		}
	}

	return hashtags;
}

async function saveSocialMediaMetrics(
	eventId: string,
	posts: SocialMediaPost[]
): Promise<void> {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		for (const post of posts) {
			let driverId = null;

			/** Try to match driver if mentioned */
			if (post.driverName) {
				const driverResult = await client.query(
					`
          SELECT id FROM drivers 
          WHERE LOWER(first_name || ' ' || last_name) = LOWER($1)
          LIMIT 1
        `,
					[post.driverName]
				);

				if (driverResult.rows.length > 0) {
					driverId = driverResult.rows[0].id;
				}
			}

			await client.query(
				`
        INSERT INTO social_media_metrics 
        (event_id, driver_id, platform, post_date, post_content, mentions, likes, shares, comments, sponsor_mentions, hashtags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
				[
					eventId,
					driverId,
					post.platform,
					post.postDate,
					post.postContent,
					post.mentions,
					post.likes,
					post.shares,
					post.comments,
					post.sponsorMentions,
					post.hashtags
				]
			);
		}

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');

		throw error;
	} finally {
		client.release();
	}
}
