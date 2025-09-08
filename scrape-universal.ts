import 'dotenv/config';
import { pool } from './src/database';
import * as cheerio from 'cheerio';

interface UniversalConfig {
  dataType: 'paint-schemes' | 'race-results' | 'standings' | 'all';
  years: number[];
  startYear?: number;
  endYear?: number;
  series?: string[];
  maxRecords?: number;
  outputFormat?: 'database' | 'json' | 'csv';
  verbose?: boolean;
}

class UniversalScraper {
  private config: UniversalConfig;

  constructor(config: Partial<UniversalConfig> = {}) {
    const currentYear = new Date().getFullYear();
    
    this.config = {
      dataType: 'all',
      years: [],
      startYear: currentYear - 2,
      endYear: currentYear,
      series: ['cup-series'],
      maxRecords: 1000,
      outputFormat: 'database',
      verbose: true,
      ...config
    };

    // Generate years array if not provided
    if (this.config.years.length === 0 && this.config.startYear && this.config.endYear) {
      for (let year = this.config.startYear; year <= this.config.endYear; year++) {
        this.config.years.push(year);
      }
    }
  }

  async scrape() {
    this.log(`🚀 Starting universal NASCAR scraper...`);
    this.log(`📊 Data type: ${this.config.dataType}`);
    this.log(`📅 Years: ${this.config.years.join(', ')}`);
    this.log(`🏆 Series: ${this.config.series?.join(', ')}`);
    this.log(`📈 Max records: ${this.config.maxRecords}`);

    const results = {
      paintSchemes: 0,
      raceResults: 0,
      standings: 0,
      errors: 0
    };

    try {
      if (this.config.dataType === 'paint-schemes' || this.config.dataType === 'all') {
        results.paintSchemes = await this.scrapePaintSchemes();
      }

      if (this.config.dataType === 'race-results' || this.config.dataType === 'all') {
        results.raceResults = await this.scrapeRaceResults();
      }

      if (this.config.dataType === 'standings' || this.config.dataType === 'all') {
        results.standings = await this.scrapeStandings();
      }

      this.log('\n🏁 Universal scraping complete!');
      this.log(`📊 Results: ${JSON.stringify(results, null, 2)}`);

    } catch (error) {
      this.log(`❌ Scraping failed: ${error}`);
      results.errors++;
    }

    return results;
  }

  private async scrapePaintSchemes(): Promise<number> {
    this.log('\n🎨 Scraping paint schemes...');
    let count = 0;

    const teams = ['hendrick-motorsports', 'joe-gibbs-racing', 'team-penske'];
    const carNumbers = ['5', '9', '24', '48', '11', '18', '19', '20', '2', '12', '22'];

    for (const year of this.config.years) {
      if (count >= this.config.maxRecords!) break;

      for (const team of teams) {
        for (const carNum of carNumbers) {
          if (count >= this.config.maxRecords!) break;

          try {
            const url = `https://www.jayski.com/paint-schemes/cup-series-paint-schemes/${year}-nascar-cup-series-${carNum}-${team}-paint-schemes/`;
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              }
            });

            if (response.ok) {
              const html = await response.text();
              const schemes = this.extractPaintSchemes(html, carNum, year);
              
              if (schemes.length > 0) {
                await this.savePaintSchemes(schemes, year);
                count += schemes.length;
                this.log(`  ✅ ${year} #${carNum}: ${schemes.length} schemes`);
              } else {
                this.log(`  ⚠️ ${year} #${carNum}: No schemes found`);
              }
            } else {
              this.log(`  ❌ ${year} #${carNum}: HTTP ${response.status}`);
            }

            await this.delay(800);

          } catch (error) {
            this.log(`  ⚠️ Failed ${year} #${carNum}`);
          }
        }
      }
    }

    return count;
  }

  private async scrapeRaceResults(): Promise<number> {
    this.log('\n🏁 Scraping race results...');
    let count = 0;

    const races = [
      'daytona-500', 'las-vegas-400', 'phoenix-500', 'atlanta-400',
      'richmond-400', 'martinsville-500', 'bristol-500'
    ];

    for (const year of this.config.years) {
      if (count >= this.config.maxRecords!) break;

      for (const race of races) {
        if (count >= this.config.maxRecords!) break;

        try {
          const url = `https://www.nascar.com/results/racecenter/${year}/${race}/`;
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            }
          });

          if (response.ok) {
            const html = await response.text();
            const results = this.extractRaceResults(html, race, year);
            
            if (results.length > 0) {
              await this.saveRaceResults(results, race, year);
              count += results.length;
              this.log(`  ✅ ${year} ${race}: ${results.length} results`);
            } else {
              this.log(`  ⚠️ ${year} ${race}: No results found`);
            }
          } else {
            this.log(`  ❌ ${year} ${race}: HTTP ${response.status}`);
          }

          await this.delay(1200);

        } catch (error) {
          this.log(`  ⚠️ Failed ${year} ${race}`);
        }
      }
    }

    return count;
  }

  private async scrapeStandings(): Promise<number> {
    this.log('\n📊 Scraping standings...');
    let count = 0;

    for (const year of this.config.years) {
      if (count >= this.config.maxRecords!) break;

      try {
        const url = `https://www.nascar.com/standings/cup-series/${year}/`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        if (response.ok) {
          const html = await response.text();
          const standings = this.extractStandings(html, year);
          
          if (standings.length > 0) {
            await this.saveStandings(standings, year);
            count += standings.length;
            this.log(`  ✅ ${year} standings: ${standings.length} drivers`);
          } else {
            this.log(`  ⚠️ ${year} standings: No standings found`);
          }
        } else {
          this.log(`  ❌ ${year} standings: HTTP ${response.status}`);
        }

        await this.delay(1000);

      } catch (error) {
        this.log(`  ⚠️ Failed ${year} standings`);
      }
    }

    return count;
  }

  private extractPaintSchemes(html: string, carNumber: string, year: number) {
    try {
      const $ = cheerio.load(html);
      const schemes: any[] = [];

      // Look for paint scheme entries in various formats
      $('.entry-content img, .wp-block-image img, .paint-scheme-image').each((i, img) => {
        const $img = $(img);
        const imageUrl = $img.attr('src') || '';
        
        // Get surrounding text for car/driver/sponsor info
        const $parent = $img.closest('figure, .wp-block-image, p').parent();
        const text = $parent.text() + ' ' + $img.attr('alt') + ' ' + $img.attr('title');
        
        // Extract car number from text or image
        const carMatch = text.match(/#?(\d{1,3})\s/);
        const extractedCarNumber = carMatch ? carMatch[1] : carNumber;
        
        // Extract driver name (usually after car number)
        const driverMatch = text.match(/#?\d+\s+([A-Za-z\s]+?)(?:\s-|\s–|sponsored|paint)/i);
        const driverName = driverMatch?.[1]?.trim() || '';
        
        // Extract sponsor (usually after "sponsored by" or similar)
        const sponsorMatch = text.match(/(?:sponsored by|primary sponsor|featuring)\s+([^.]+)/i);
        const sponsorText = sponsorMatch?.[1]?.trim() || '';
        
        if (extractedCarNumber && (driverName || sponsorText || imageUrl)) {
          schemes.push({
            carNumber: extractedCarNumber,
            driverName: this.cleanDriverName(driverName),
            primarySponsor: this.parseSponsorText(sponsorText).primary,
            associateSponsors: this.parseSponsorText(sponsorText).associates,
            schemeType: this.detectSchemeType(text),
            imageUrl: imageUrl ? new URL(imageUrl, 'https://www.jayski.com').href : '',
            year
          });
        }
      });

      // Also check for structured content
      $('.paint-scheme-entry, .car-entry').each((i, element) => {
        const $elem = $(element);
        const extractedCarNumber = $elem.find('.car-number').text().trim() || 
                         $elem.text().match(/#(\d+)/)?.[1] || carNumber;
        const driverName = $elem.find('.driver-name').text().trim();
        const sponsorText = $elem.find('.sponsor').text().trim();

        if (extractedCarNumber) {
          schemes.push({
            carNumber: extractedCarNumber,
            driverName: this.cleanDriverName(driverName),
            primarySponsor: this.parseSponsorText(sponsorText).primary,
            associateSponsors: this.parseSponsorText(sponsorText).associates,
            schemeType: this.detectSchemeType($elem.text()),
            imageUrl: $elem.find('img').attr('src') || '',
            year
          });
        }
      });

      return schemes;
    } catch (error) {
      this.log(`Error extracting paint schemes: ${error}`);
      return [];
    }
  }

  private extractRaceResults(html: string, race: string, year: number) {
    try {
      const $ = cheerio.load(html);
      const results: any[] = [];

      // Look for race results table or results container
      $('.results-table tr, .race-results .result-row, .driver-result').each((i, row) => {
        const $row = $(row);
        
        // Skip header rows
        if ($row.find('th').length > 0) return;
        
        const cells = $row.find('td, .result-cell');
        if (cells.length === 0) return;
        
        // Extract position (usually first column)
        const position = $(cells[0]).text().trim().replace(/\D/g, '') || (i + 1).toString();
        
        // Extract driver name
        const driverCell = cells.length > 1 ? $(cells[1]) : $row.find('.driver-name');
        const driverName = driverCell.text().trim();
        
        // Extract car number
        const carMatch = $row.text().match(/#(\d{1,3})/);
        const carNumber = carMatch ? carMatch[1] : '';
        
        // Extract team/manufacturer info
        const teamInfo = $row.find('.team, .manufacturer').text().trim();
        
        if (position && driverName) {
          results.push({
            position: parseInt(position),
            driverName: this.cleanDriverName(driverName),
            carNumber,
            teamInfo,
            race,
            year
          });
        }
      });

      // Alternative: Look for JSON data in script tags (NASCAR often embeds data)
      $('script').each((i, script) => {
        const scriptContent = $(script).html() || '';
        if (scriptContent.includes('raceResults') || scriptContent.includes('drivers')) {
          try {
            // Extract JSON data if available
            const jsonMatch = scriptContent.match(/"results":\s*(\[.*?\])/s);
            if (jsonMatch && jsonMatch[1]) {
              const jsonData = JSON.parse(jsonMatch[1]);
              jsonData.forEach((result: any, index: number) => {
                if (result.driver || result.name) {
                  results.push({
                    position: result.position || result.finish || (index + 1),
                    driverName: this.cleanDriverName(result.driver || result.name || ''),
                    carNumber: result.car || result.number || '',
                    teamInfo: result.team || result.manufacturer || '',
                    race,
                    year
                  });
                }
              });
            }
          } catch (e) {
            // JSON parsing failed, continue with HTML parsing
          }
        }
      });

      return results;
    } catch (error) {
      this.log(`Error extracting race results: ${error}`);
      return [];
    }
  }

  private extractStandings(html: string, year: number) {
    try {
      const $ = cheerio.load(html);
      const standings: any[] = [];

      // Look for standings table
      $('.standings-table tr, .driver-standings .standing-row, .points-table tr').each((i, row) => {
        const $row = $(row);
        
        // Skip header rows
        if ($row.find('th').length > 0) return;
        
        const cells = $row.find('td, .standing-cell');
        if (cells.length === 0) return;
        
        // Extract position (usually first column)
        const position = $(cells[0]).text().trim().replace(/\D/g, '') || (i + 1).toString();
        
        // Extract driver name
        const driverCell = cells.length > 1 ? $(cells[1]) : $row.find('.driver-name');
        const driverName = driverCell.text().trim();
        
        // Extract points (usually in a points column)
        const pointsText = $row.find('.points, .total-points').text().trim() || 
                          $(cells[cells.length - 1]).text().trim();
        const points = pointsText.replace(/\D/g, '') || '0';
        
        // Extract wins (if available)
        const winsText = $row.find('.wins').text().trim();
        const wins = winsText.replace(/\D/g, '') || '0';
        
        if (position && driverName) {
          standings.push({
            position: parseInt(position),
            driverName: this.cleanDriverName(driverName),
            points: parseInt(points),
            wins: parseInt(wins),
            year
          });
        }
      });

      // Alternative: Look for JSON data in script tags
      $('script').each((i, script) => {
        const scriptContent = $(script).html() || '';
        if (scriptContent.includes('standings') || scriptContent.includes('points')) {
          try {
            const jsonMatch = scriptContent.match(/"standings":\s*(\[.*?\])/s);
            if (jsonMatch && jsonMatch[1]) {
              const jsonData = JSON.parse(jsonMatch[1]);
              jsonData.forEach((standing: any) => {
                if (standing.driver || standing.name) {
                  standings.push({
                    position: standing.position || standing.rank,
                    driverName: this.cleanDriverName(standing.driver || standing.name || ''),
                    points: standing.points || 0,
                    wins: standing.wins || 0,
                    year
                  });
                }
              });
            }
          } catch (e) {
            // JSON parsing failed, continue with HTML parsing
          }
        }
      });

      return standings;
    } catch (error) {
      this.log(`Error extracting standings: ${error}`);
      return [];
    }
  }

  private async savePaintSchemes(schemes: any[], year: number) {
    const client = await pool.connect();
    try {
      for (const scheme of schemes) {
        await client.query(`
          INSERT INTO paint_schemes (car_number, driver_name, primary_sponsor, scheme_type, image_url, year, scraped_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (car_number, year, driver_name) DO UPDATE SET
            primary_sponsor = EXCLUDED.primary_sponsor,
            scheme_type = EXCLUDED.scheme_type,
            image_url = EXCLUDED.image_url,
            scraped_at = NOW()
        `, [
          scheme.carNumber,
          scheme.driverName,
          scheme.primarySponsor,
          scheme.schemeType,
          scheme.imageUrl,
          scheme.year
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.log(`Error saving paint schemes: ${error}`);
    } finally {
      client.release();
    }
  }

  private async saveRaceResults(results: any[], race: string, year: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const result of results) {
        await client.query(`
          INSERT INTO race_results (position, driver_name, car_number, team_info, race_name, year, scraped_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (race_name, year, position) DO UPDATE SET
            driver_name = EXCLUDED.driver_name,
            car_number = EXCLUDED.car_number,
            team_info = EXCLUDED.team_info,
            scraped_at = NOW()
        `, [
          result.position,
          result.driverName,
          result.carNumber,
          result.teamInfo,
          race,
          year
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.log(`Error saving race results: ${error}`);
    } finally {
      client.release();
    }
  }

  private async saveStandings(standings: any[], year: number) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const standing of standings) {
        await client.query(`
          INSERT INTO driver_standings (position, driver_name, points, wins, year, scraped_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
          ON CONFLICT (year, position) DO UPDATE SET
            driver_name = EXCLUDED.driver_name,
            points = EXCLUDED.points,
            wins = EXCLUDED.wins,
            scraped_at = NOW()
        `, [
          standing.position,
          standing.driverName,
          standing.points,
          standing.wins,
          standing.year
        ]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.log(`Error saving standings: ${error}`);
    } finally {
      client.release();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private parseSponsorText(text: string): { primary: string; associates: string[] } {
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

  private cleanDriverName(name: string): string {
    return name
      .replace(/^#\d+\s*/, '')
      .replace(/\s*\(.*\)/, '')
      .trim();
  }

  private detectSchemeType(text: string): string {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('throwback')) return 'throwback';
    if (lowerText.includes('special')) return 'special';
    if (lowerText.includes('playoff')) return 'playoff';
    return 'regular';
  }

  private log(message: string) {
    if (this.config.verbose) {
      console.log(message);
    }
  }
}

// CLI interface
function parseArgs(): Partial<UniversalConfig> {
  const args = process.argv.slice(2);
  const config: Partial<UniversalConfig> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
        config.dataType = args[++i] as any;
        break;
      case '--start-year':
        config.startYear = Number(args[++i]);
        break;
      case '--end-year':
        config.endYear = Number(args[++i]);
        break;
      case '--years':
        const yearsArg = args[++i];
        if (yearsArg) {
          config.years = yearsArg.split(',').map(Number);
        }
        break;
      case '--max':
        config.maxRecords = Number(args[++i]);
        break;
      case '--series':
        const seriesArg = args[++i];
        if (seriesArg) {
          config.series = seriesArg.split(',');
        }
        break;
      case '--output':
        config.outputFormat = args[++i] as any;
        break;
      case '--quiet':
        config.verbose = false;
        break;
    }
  }

  return config;
}

// Usage examples in comments:
/*
Examples:
pnpm dlx ts-node scrape-universal.ts --type paint-schemes --start-year 2020 --end-year 2024
pnpm dlx ts-node scrape-universal.ts --type race-results --years 2023,2024 --max 500
pnpm dlx ts-node scrape-universal.ts --type all --start-year 2022 --end-year 2024 --series cup-series,xfinity
*/

const config = parseArgs();
const scraper = new UniversalScraper(config);
scraper.scrape();
