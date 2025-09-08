import { pool } from './database';
import * as cheerio from 'cheerio';

interface PaintScheme {
  carNumber: string;
  driverName: string;
  primarySponsor: string;
  associateSponsors: string[];
  schemeType: string;
  imageUrl?: string;
}

export async function scrapeJayskiPaintSchemes(year: number): Promise<void> {
  try {
    // Main paint schemes page
    const mainUrl = `https://www.jayski.com/paint-schemes/cup-series-paint-schemes/${year}-nascar-cup-series-paint-schemes/`;
    console.log(`Scraping main paint schemes: ${mainUrl}`);
    
    const schemes = await scrapePaintSchemePage(mainUrl);
    
    // Get team-specific pages
    const teamUrls = await getTeamUrls(year);
    
    for (const teamUrl of teamUrls) {
      console.log(`Scraping team page: ${teamUrl}`);
      const teamSchemes = await scrapePaintSchemePage(teamUrl);
      schemes.push(...teamSchemes);
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (schemes.length > 0) {
      await savePaintSchemes(schemes, year);
      console.log(`Scraped ${schemes.length} paint schemes for ${year}`);
    }

  } catch (error) {
    console.error('Error scraping Jayski paint schemes:', error);
  }
}

async function getTeamUrls(year: number): Promise<string[]> {
  // Common team/car number combinations
  const teams = [
    { carNumber: '1', team: 'trackhouse-racing' },
    { carNumber: '2', team: 'team-penske' },
    { carNumber: '3', team: 'richard-childress-racing' },
    { carNumber: '4', team: 'stewart-haas-racing' },
    { carNumber: '5', team: 'hendrick-motorsports' },
    { carNumber: '6', team: 'roush-fenway-keselowski-racing' },
    { carNumber: '8', team: 'richard-childress-racing' },
    { carNumber: '9', team: 'hendrick-motorsports' },
    { carNumber: '11', team: 'joe-gibbs-racing' },
    { carNumber: '12', team: 'team-penske' },
    { carNumber: '14', team: 'stewart-haas-racing' },
    { carNumber: '17', team: 'roush-fenway-keselowski-racing' },
    { carNumber: '18', team: 'joe-gibbs-racing' },
    { carNumber: '19', team: 'joe-gibbs-racing' },
    { carNumber: '20', team: 'joe-gibbs-racing' },
    { carNumber: '22', team: 'team-penske' },
    { carNumber: '23', team: '23xi-racing' },
    { carNumber: '24', team: 'hendrick-motorsports' },
    { carNumber: '45', team: '23xi-racing' },
    { carNumber: '48', team: 'hendrick-motorsports' }
  ];

  return teams.map(({ carNumber, team }) => 
    `https://www.jayski.com/paint-schemes/cup-series-paint-schemes/${year}-nascar-cup-series-${carNumber}-${team}-paint-schemes/`
  );
}

async function scrapePaintSchemePage(url: string): Promise<PaintScheme[]> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    const schemes: PaintScheme[] = [];

    // Look for paint scheme entries in various formats
    $('.entry-content img, .wp-block-image img, .paint-scheme-image').each((i, img) => {
      const $img = $(img);
      const imageUrl = $img.attr('src') || '';
      
      // Get surrounding text for car/driver/sponsor info
      const $parent = $img.closest('figure, .wp-block-image, p').parent();
      const text = $parent.text() + ' ' + $img.attr('alt') + ' ' + $img.attr('title');
      
      // Extract car number from text or image
      const carMatch = text.match(/#?(\d{1,3})\s/);
      const carNumber = carMatch ? carMatch[1] : '';

      // Extract driver name (usually after car number)
      const driverMatch = text.match(/#?\d+\s+([A-Za-z\s]+?)(?:\s-|\s–|sponsored|paint)/i);
      const driverName = driverMatch?.[1]?.trim() || '';

      // Extract sponsor (usually after "sponsored by" or similar)
      const sponsorMatch = text.match(/(?:sponsored by|primary sponsor|featuring)\s+([^.]+)/i);
      const sponsorText = sponsorMatch?.[1]?.trim() || '';

      if (carNumber && (driverName || sponsorText)) {
        const sponsors = parseSponsorText(sponsorText);
        
        schemes.push({
          carNumber,
          driverName: cleanDriverName(driverName),
          primarySponsor: sponsors.primary,
          associateSponsors: sponsors.associates,
          schemeType: detectSchemeType(text),
          imageUrl: imageUrl ? new URL(imageUrl, url).href : ''
        });
      }
    });

    // Also check for structured content
    $('.paint-scheme-entry, .car-entry').each((i, element) => {
      const $elem = $(element);
      const carNumber = $elem.find('.car-number').text().trim() || 
                       $elem.text().match(/#(\d+)/)?.[1] || '';
      const driverName = $elem.find('.driver-name').text().trim();
      const sponsorText = $elem.find('.sponsor').text().trim();

      if (carNumber) {
        const sponsors = parseSponsorText(sponsorText);
        schemes.push({
          carNumber,
          driverName: cleanDriverName(driverName),
          primarySponsor: sponsors.primary,
          associateSponsors: sponsors.associates,
          schemeType: detectSchemeType($elem.text()),
          imageUrl: $elem.find('img').attr('src') || ''
        });
      }
    });

    return schemes;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return [];
  }
}

function parseSponsorText(text: string): { primary: string; associates: string[] } {
  if (!text) return { primary: '', associates: [] };

  const cleanText = text.replace(/\s+/g, ' ').trim();
  const primaryMatch = cleanText.match(/^([^,/&]+)/);
  const primary = primaryMatch?.[1]?.trim() || '';

  const associates = cleanText
    .split(/[,/&]/)
    .slice(1)
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.length < 50);

  return { primary, associates };
}

function cleanDriverName(name: string): string {
  return name
    .replace(/^#\d+\s*/, '')
    .replace(/\s*\(.*\)/, '')
    .trim();
}

function detectSchemeType(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('throwback')) return 'throwback';
  if (lowerText.includes('special')) return 'special';
  if (lowerText.includes('playoff')) return 'playoff';
  return 'regular';
}

async function savePaintSchemes(schemes: PaintScheme[], year: number): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    for (const scheme of schemes) {
      const eventResult = await client.query(`
        SELECT e.id as event_id
        FROM events e
        JOIN seasons s ON e.season_id = s.id
        WHERE s.year = $1
        ORDER BY e.event_date DESC
        LIMIT 1
      `, [year]);

      if (eventResult.rows.length === 0) continue;
      const eventId = eventResult.rows[0].event_id;

      const driverId = scheme.driverName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const nameParts = scheme.driverName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || scheme.driverName;

      await client.query(`
        INSERT INTO drivers (id, first_name, last_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3
      `, [driverId, firstName, lastName]);

      await client.query(`
        INSERT INTO paint_schemes 
        (event_id, driver_id, car_number, primary_sponsor, associate_sponsors, scheme_type, scheme_image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (event_id, driver_id)
        DO UPDATE SET 
          car_number = $3,
          primary_sponsor = $4,
          associate_sponsors = $5,
          scheme_type = $6,
          scheme_image_url = $7
      `, [
        eventId,
        driverId,
        scheme.carNumber,
        scheme.primarySponsor,
        scheme.associateSponsors,
        scheme.schemeType,
        scheme.imageUrl
      ]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
