/** Apex Data API - GraphQL Schema (Type Definitions) */
/** Comprehensive, self-documenting schema for NASCAR data analysis */

export const typeDefs = `#graphql
  """
  Represents an individual NASCAR driver with personal information and career data
  """
  type Driver {
    "Unique identifier for the driver"
    id: ID!
    "Full name of the driver (first and last name combined)"
    name: String!
    "Driver's date of birth in YYYY-MM-DD format"
    dateOfBirth: String
    "Driver's hometown (city, state format)"
    hometown: String
    "All races this driver has participated in with optional filtering"
    races(year: Int, trackId: String, limit: Int, offset: Int): [Race!]!
    "All teams this driver has competed for throughout their career"
    teams: [Team!]!
  }

  """
  Represents a NASCAR racing team with organizational details
  """
  type Team {
    "Unique identifier for the team"
    id: ID!
    "Official team name"
    name: String!
    "Car manufacturer (Chevrolet, Ford, Toyota, etc.)"
    manufacturer: String
    "Team owner or ownership group"
    owner: String
    "Team headquarters location (city, state format)"
    location: String
    "Year the team was founded"
    foundedYear: Int
    "Drivers who have competed for this team"
    drivers: [Driver!]
    "All races this team has participated in"
    races: [Race!]!
  }

  """
  Represents a NASCAR racing venue with physical characteristics
  """
  type Track {
    "Unique identifier for the track"
    id: ID!
    "Official track name"
    name: String!
    "City where the track is located"
    city: String
    "State where the track is located"
    state: String
    "Track length in miles"
    lengthMiles: Float
    "Track configuration type (Oval, Road Course, etc.)"
    type: String
    "Track surface material (asphalt, dirt, concrete)"
    surface: String
    "All races held at this track with optional filtering"
    races(year: Int, limit: Int, offset: Int): [Race!]!
    "All drivers who have competed at this track with optional year filtering"
    drivers(year: Int): [Driver!]!
    "All teams that have competed at this track with optional year filtering"
    teams(year: Int): [Team!]!
    "Performance statistics at this track, optionally filtered by driver or team"
    stats(driverId: ID, teamId: ID): TrackStats
  }

  """
  Represents a NASCAR racing series
  """
  type Series {
    "Unique identifier for the series"
    id: ID!
    "Series name (Cup Series, Xfinity Series, etc.)"
    name: String!
    "Full official series name"
    fullName: String
    "Series abbreviation (CUP, XFN, TRK)"
    abbreviation: String
  }

  """
  Represents a NASCAR practice session
  """
  type PracticeSession {
    "Unique identifier for this practice session"
    id: ID!
    "Practice session name (Practice 1, Practice 2, etc.)"
    sessionName: String!
    "Date and time of practice session"
    sessionDate: String
    "Session duration in minutes"
    sessionDuration: Int
    "Practice results for all drivers in this session"
    results: [PracticeResult!]!
  }

  """
  Represents a driver's performance in a practice session
  """
  type PracticeResult {
    "Unique identifier for this practice result"
    id: ID!
    "Position in practice session (1st, 2nd, etc.)"
    position: Int
    "Best lap time achieved in session"
    bestTime: String
    "Best speed achieved in MPH"
    bestSpeed: Float
    "Total laps completed in session"
    lapsCompleted: Int
    "Driver who achieved this result"
    driver: Driver!
    "Team the driver practiced for"
    team: Team!
  }

  """
  Represents a single NASCAR race event
  """
  type Race {
    "Unique identifier for the race"
    id: ID!
    "Official race name (e.g., 'Daytona 500')"
    name: String!
    "Date the race was held in YYYY-MM-DD format"
    eventDate: String!
    "Total number of lead changes during the race"
    leadChanges: Int
    "Number of different drivers who led the race"
    differentLeaders: Int
    "NASCAR series this race belongs to"
    series: Series!
    "Track where the race was held"
    track: Track!
    "Practice sessions for this race weekend with optional filtering"
    practiceSessions(sessionName: String, limit: Int, offset: Int): [PracticeSession!]!
    "Complete race results with optional filtering and sorting"
    results(filter: ResultFilter, sort: ResultSort, limit: Int): [DriverResult!]!
    "Stage winners and points for each stage"
    stageResults: [StageResult!]!
    "Qualifying results with times and speeds"
    qualifyingResults: [QualifyingResult!]!
    "Caution flags and incidents during the race"
    cautions: [RaceCaution!]!
  }

  """
  Represents a caution flag period during a NASCAR race
  """
  type RaceCaution {
    "Unique identifier for this caution"
    id: ID!
    "Sequential caution number in the race"
    cautionNumber: Int!
    "Lap when caution flag was displayed"
    lapStart: Int!
    "Lap when green flag was displayed"
    lapEnd: Int
    "Total laps run under caution"
    lapsUnderCaution: Int
    "Reason for caution (accident, debris, weather, etc.)"
    reason: String
  }

  """
  Represents a driver's qualifying performance for a specific race
  """
  type QualifyingResult {
    "Unique identifier for this qualifying result"
    id: ID!
    "Qualifying position (1st, 2nd, etc.)"
    qualifyingPosition: Int!
    "Qualifying lap time (e.g., '29.123')"
    qualifyingTime: String
    "Qualifying speed in MPH"
    qualifyingSpeed: Float
    "Driver who achieved this qualifying result"
    driver: Driver!
    "Team the driver qualified for"
    team: Team!
  }

  """
  Represents a stage winner and points earned in a NASCAR race stage
  """
  type StageResult {
    "Unique identifier for this stage result"
    id: ID!
    "Stage number (1, 2, etc.)"
    stageNumber: Int!
    "Points earned for winning this stage"
    stagePoints: Int
    "Driver who won the stage"
    driver: Driver!
    "Team the driver competed for in this stage"
    team: Team!
  }

  """
  Represents a NASCAR car sponsor
  """
  type Sponsor {
    "Unique identifier for the sponsor"
    id: ID!
    "Official sponsor name"
    name: String!
    "Sponsor industry category"
    industry: String
    "Sponsor website URL"
    website: String
  }

  """
  Represents a single driver's performance in a specific race
  """
  type DriverResult {
    "Unique identifier for this race result"
    id: ID!
    "Final finishing position (1st, 2nd, etc.)"
    finishPosition: Int!
    "Starting position at race beginning"
    startPosition: Int!
    "Car number used in this race"
    carNumber: String!
    "Total laps completed during the race"
    lapsCompleted: Int!
    "Number of laps led during the race"
    lapsLed: Int!
    "Final race status (Running, Accident, Engine, etc.)"
    status: String!
    "Car manufacturer for this specific race"
    manufacturer: String
    "Prize money earned for this race result in USD"
    prizeMoney: Float
    "Championship points earned for this race"
    points: Int
    "Number of pit stops made during the race"
    pitStops: Int
    "NASCAR Driver Rating for this race (0.0-150.0+)"
    driverRating: Float
    "Number of times driver had fastest lap in race"
    fastestLaps: Int
    "Total number of green flag passes made"
    passesMade: Int
    "Number of passes made on top-15 cars under green"
    qualityPasses: Int
    "Average position throughout the race"
    avgRunningPosition: Float
    "Primary sponsor for this race entry"
    sponsor: Sponsor
    "Driver who achieved this result"
    driver: Driver!
    "Team the driver competed for in this race"
    team: Team!
  }

  """
  Performance statistics for a driver or team at a specific track
  """
  type TrackStats {
    "Total number of races at this track"
    totalRaces: Int!
    "Average finishing position"
    avgFinishPosition: Float
    "Number of race wins"
    wins: Int!
    "Number of top-5 finishes"
    topFives: Int!
    "Number of top-10 finishes"
    topTens: Int!
    "Total prize money earned at this track"
    totalEarnings: Float
    "Average prize money per race"
    avgEarnings: Float
    "Total championship points earned"
    totalPoints: Int
    "Average points per race"
    avgPoints: Float
    "Average pit stops per race"
    avgPitStops: Float
    "Average driver rating at this track"
    avgDriverRating: Float
  }

  """
  Comprehensive performance statistics for a driver
  """
  type DriverStats {
    "Total number of races participated in"
    totalRaces: Int!
    "Total number of race wins"
    wins: Int!
    "Total number of top-5 finishes"
    topFives: Int!
    "Total number of top-10 finishes"
    topTens: Int!
    "Total number of pole positions"
    poles: Int!
    "Average finishing position across all races"
    avgFinishPosition: Float
    "Average starting position across all races"
    avgStartPosition: Float
    "Total laps led across all races"
    totalLapsLed: Int!
    "Average laps led per race"
    avgLapsLed: Float
    "Total championship points earned"
    totalPoints: Int
    "Average points per race"
    avgPoints: Float
    "Total career prize money earnings"
    totalEarnings: Float
    "Average earnings per race"
    avgEarnings: Float
    "Average driver rating across all races"
    avgDriverRating: Float
    "Average pit stops per race"
    avgPitStops: Float
    "Win percentage (wins/total races * 100)"
    winPercentage: Float
    "Top-5 percentage (top-5s/total races * 100)"
    topFivePercentage: Float
    "Top-10 percentage (top-10s/total races * 100)"
    topTenPercentage: Float
  }

  """
  Comprehensive performance statistics for a team
  """
  type TeamStats {
    "Total number of races participated in"
    totalRaces: Int!
    "Total number of race wins"
    wins: Int!
    "Total number of top-5 finishes"
    topFives: Int!
    "Total number of top-10 finishes"
    topTens: Int!
    "Total number of pole positions"
    poles: Int!
    "Average finishing position across all races"
    avgFinishPosition: Float
    "Average starting position across all races"
    avgStartPosition: Float
    "Total laps led across all races"
    totalLapsLed: Int!
    "Average laps led per race"
    avgLapsLed: Float
    "Total championship points earned"
    totalPoints: Int
    "Average points per race"
    avgPoints: Float
    "Total prize money earnings"
    totalEarnings: Float
    "Average earnings per race"
    avgEarnings: Float
    "Average driver rating across all races"
    avgDriverRating: Float
    "Average pit stops per race"
    avgPitStops: Float
    "Win percentage (wins/total races * 100)"
    winPercentage: Float
    "Top-5 percentage (top-5s/total races * 100)"
    topFivePercentage: Float
    "Top-10 percentage (top-10s/total races * 100)"
    topTenPercentage: Float
    "Number of different drivers who have competed for this team"
    activeDrivers: Int!
  }

  """
  Stage performance statistics
  """
  type StageStats {
    "Total number of stage wins"
    stageWins: Int!
    "Total stage points earned"
    totalStagePoints: Int!
    "Average stage points per race"
    avgStagePoints: Float
    "Total number of races with stage data"
    races: Int!
  }

  """
  Qualifying performance statistics
  """
  type QualifyingStats {
    "Total number of qualifying sessions"
    totalQualifying: Int!
    "Total number of pole positions"
    poles: Int!
    "Average qualifying position"
    avgQualifyingPosition: Float
    "Best qualifying position achieved"
    bestQualifyingPosition: Int
    "Average qualifying speed"
    avgQualifyingSpeed: Float
    "Fastest qualifying speed achieved"
    fastestQualifyingSpeed: Float
    "Pole position percentage"
    polePercentage: Float
  }

  """
  Caution flag statistics
  """
  type CautionStats {
    "Total number of cautions"
    totalCautions: Int!
    "Average cautions per race"
    avgCautions: Float
    "Total laps under caution"
    totalCautionLaps: Int!
    "Average caution laps per race"
    avgCautionLaps: Float
    "Percentage of race run under caution"
    cautionPercentage: Float
    "Total number of races"
    races: Int!
  }

  """
  Race dynamics statistics
  """
  type RaceDynamicsStats {
    "Average lead changes per race"
    avgLeadChanges: Float
    "Average different leaders per race"
    avgDifferentLeaders: Float
    "Maximum lead changes in a single race"
    maxLeadChanges: Int
    "Maximum different leaders in a single race"
    maxDifferentLeaders: Int
    "Total number of races"
    races: Int!
  }

  """
  Sponsor performance statistics
  """
  type SponsorStats {
    "Total number of races sponsored"
    totalRaces: Int!
    "Total number of wins"
    wins: Int!
    "Total number of top-5 finishes"
    topFives: Int!
    "Total number of top-10 finishes"
    topTens: Int!
    "Average finishing position"
    avgFinishPosition: Float
    "Total prize money earnings"
    totalEarnings: Float
    "Win percentage (wins/total races * 100)"
    winPercentage: Float
  }

  """
  Championship performance analytics for drivers or teams
  """
  type ChampionshipStats {
    "Total championship points earned"
    totalPoints: Int!
    "Average points per race"
    averagePoints: Float
    "Total number of races"
    races: Int!
    "Number of race wins"
    wins: Int!
    "Number of top-5 finishes"
    topFives: Int!
    "Number of top-10 finishes"
    topTens: Int!
  }

  """
  Financial performance analytics
  """
  type FinancialStats {
    "Total prize money earnings"
    totalEarnings: Float!
    "Average earnings per race"
    averageEarnings: Float
    "Highest single race payout"
    highestPayout: Float
    "Total number of races"
    races: Int!
  }

  """
  Driver rating performance analytics
  """
  type DriverRatingStats {
    "Average driver rating across all races"
    averageRating: Float
    "Highest driver rating achieved"
    highestRating: Float
    "Lowest driver rating recorded"
    lowestRating: Float
    "Total number of races with rating data"
    races: Int!
  }

  """
  Manufacturer performance statistics
  """
  type ManufacturerStats {
    "Manufacturer name (Chevrolet, Ford, Toyota, etc.)"
    manufacturer: String!
    "Total races participated in"
    totalRaces: Int!
    "Total number of wins"
    wins: Int!
    "Total number of top-5 finishes"
    topFives: Int!
    "Total number of top-10 finishes"
    topTens: Int!
    "Average finishing position"
    avgFinishPosition: Float
  }

  """
  Comprehensive track performance and characteristics analytics
  """
  type TrackAnalytics {
    "Total number of races held at this track"
    totalRaces: Int!
    "Average number of cautions per race"
    avgCautions: Float
    "Average laps under caution per race"
    avgCautionLaps: Float
    "Average number of lead changes per race"
    avgLeadChanges: Float
    "Average number of different leaders per race"
    avgDifferentLeaders: Float
    "Most frequent winning manufacturer"
    topWinningManufacturer: String
    "Average finishing position across all drivers"
    avgFinishPosition: Float
    "Average driver rating at this track"
    avgDriverRating: Float
    "Average number of pit stops per race"
    avgPitStops: Float
    "Most common caution reason"
    topCautionReason: String
    "Track competitiveness score (based on lead changes and leaders)"
    competitivenessScore: Float
  }

  """
  Input filter for race queries
  """
  input RaceFilter {
    "Filter by specific year"
    year: Int
    "Filter by specific track ID"
    trackId: String
    "Filter by manufacturer"
    manufacturer: String
    "Filter by NASCAR series"
    seriesId: String
    "Maximum number of results to return"
    limit: Int = 25
    "Number of results to skip (for pagination)"
    offset: Int = 0
  }

  """
  Input filter for track queries
  """
  input TrackFilter {
    "Filter by track type"
    type: String
    "Filter by track surface"
    surface: String
    "Filter by state"
    state: String
    "Filter by minimum track length"
    minLength: Float
    "Filter by maximum track length"
    maxLength: Float
  }

  """
  Input filter for race results
  """
  input ResultFilter {
    "Filter by manufacturer (Chevrolet, Ford, Toyota, etc.)"
    manufacturer: String
    "Filter by team ID"
    teamId: String
    "Filter by driver ID"
    driverId: String
    "Filter by finish position range"
    finishPositionMin: Int
    finishPositionMax: Int
    "Filter by start position range"
    startPositionMin: Int
    startPositionMax: Int
    "Filter by race status"
    status: String
  }

  """
  Sorting options for race results
  """
  enum ResultSortField {
    FINISH_POSITION
    START_POSITION
    LAPS_LED
    LAPS_COMPLETED
    POINTS
    PRIZE_MONEY
    DRIVER_RATING
    PIT_STOPS
    FASTEST_LAPS
    PASSES_MADE
    QUALITY_PASSES
    AVG_RUNNING_POSITION
  }

  """
  Sort direction
  """
  enum SortDirection {
    ASC
    DESC
  }

  """
  Input for sorting race results
  """
  input ResultSort {
    "Field to sort by"
    field: ResultSortField!
    "Sort direction (ASC or DESC)"
    direction: SortDirection = ASC
  }

  """
  Root query type - entry point for all GraphQL queries
  """
  type Query {
    # Race queries
    "Get races with optional filtering and pagination"
    races(filter: RaceFilter): [Race]
    "Get a specific race by ID"
    race(id: ID!): Race

    # Series queries
    "Get all NASCAR series"
    series: [Series]
    "Get a specific series by ID"
    seriesById(id: ID!): Series

    # Driver queries
    "Get all drivers"
    drivers: [Driver]
    "Get a specific driver by ID"
    driver(id: ID!): Driver
    "Get drivers from a specific hometown"
    driversByHometown(hometown: String!): [Driver]

    # Team queries
    "Get all teams"
    teams: [Team]
    "Get a specific team by ID"
    team(id: ID!): Team
    "Get teams from a specific location"
    teamsByLocation(location: String!): [Team]
    "Get teams owned by a specific owner"
    teamsByOwner(owner: String!): [Team]
    "Get teams founded in a specific year"
    teamsByFoundedYear(year: Int!): [Team]

    # Track queries
    "Get tracks with optional filtering"
    tracks(filter: TrackFilter): [Track]
    "Get a specific track by ID"
    track(id: ID!): Track
    "Get tracks of a specific type"
    tracksByType(type: String!): [Track]
    "Get tracks with a specific surface"
    tracksBySurface(surface: String!): [Track]
    "Get short tracks (under 1 mile)"
    shortTracks: [Track]
    "Get superspeedways (over 2 miles)"
    superspeedways: [Track]
    "Get road course tracks"
    roadCourses: [Track]
    "Get dirt surface tracks"
    dirtTracks: [Track]
    "Get tracks in a specific state"
    tracksByState(state: String!): [Track]
    
    # Manufacturer analytics
    "Get manufacturer performance statistics"
    manufacturerStats(trackId: String, year: Int): [ManufacturerStats]
    "Get races where a specific manufacturer participated"
    racesByManufacturer(manufacturer: String!): [Race]
    "Get teams that use a specific manufacturer"
    teamsByManufacturer(manufacturer: String!): [Team]
    
    # Financial analytics
    "Get driver earnings statistics"
    driverEarnings(driverId: ID!, year: Int): FinancialStats
    "Get team earnings statistics"
    teamEarnings(teamId: ID!, year: Int): FinancialStats
    "Get top earning drivers"
    topEarners(year: Int, limit: Int = 10): [Driver]
    "Get highest single race payouts"
    highestPayouts(year: Int, limit: Int = 10): [DriverResult]
    
    # Championship analytics
    "Get driver championship points statistics"
    driverPoints(driverId: ID!, year: Int): ChampionshipStats
    "Get team championship points statistics"
    teamPoints(teamId: ID!, year: Int): ChampionshipStats
    "Get championship points leaders"
    pointsLeaders(year: Int, limit: Int = 10): [Driver]
    "Get full championship standings for a year"
    championshipStandings(year: Int!): [Driver]
    
    # Driver rating analytics
    "Get driver rating statistics"
    driverRatingStats(driverId: ID!, year: Int): DriverRatingStats
    "Get top rated race performances"
    topRatedPerformances(year: Int, limit: Int = 10): [DriverResult]
    "Get average driver rating at a specific track"
    averageRatingByTrack(trackId: ID!): Float
    
    # Comprehensive analytics
    "Get comprehensive driver performance statistics"
    driverStats(driverId: ID!, trackId: String, year: Int): DriverStats
    "Get comprehensive team performance statistics"
    teamStats(teamId: ID!, trackId: String, year: Int): TeamStats
    
    # Stage analytics
    "Get driver stage performance statistics"
    driverStageStats(driverId: ID!, year: Int): StageStats
    "Get team stage performance statistics"
    teamStageStats(teamId: ID!, year: Int): StageStats
    "Get top stage winners"
    topStageWinners(year: Int, limit: Int = 10): [Driver]
    
    # Qualifying analytics
    "Get driver qualifying performance statistics"
    driverQualifyingStats(driverId: ID!, year: Int): QualifyingStats
    "Get team qualifying performance statistics"
    teamQualifyingStats(teamId: ID!, year: Int): QualifyingStats
    "Get fastest qualifying speeds"
    fastestQualifiers(year: Int, limit: Int = 10): [QualifyingResult]
    "Get most pole positions"
    topPoleWinners(year: Int, limit: Int = 10): [Driver]
    
    # Caution and incident analytics
    "Get caution statistics for a specific track"
    trackCautionStats(trackId: ID!, year: Int): CautionStats
    "Get races with most cautions"
    mostCautionRaces(year: Int, limit: Int = 10): [Race]
    "Get caution reasons analysis"
    cautionReasons(year: Int): [String]
    
    # Race dynamics analytics
    "Get race dynamics statistics for a specific track"
    trackDynamicsStats(trackId: ID!, year: Int): RaceDynamicsStats
    "Get most competitive races by lead changes"
    mostCompetitiveRaces(year: Int, limit: Int = 10): [Race]
    "Get races with most different leaders"
    mostLeaderRaces(year: Int, limit: Int = 10): [Race]
    
    # Sponsor queries and analytics
    "Get all sponsors"
    sponsors: [Sponsor]
    "Get a specific sponsor by ID"
    sponsor(id: ID!): Sponsor
    "Get sponsors by industry"
    sponsorsByIndustry(industry: String!): [Sponsor]
    "Get sponsor performance statistics"
    sponsorStats(sponsorId: ID!, year: Int): SponsorStats
    "Get top performing sponsors"
    topSponsors(year: Int, limit: Int = 10): [Sponsor]
    
    # Track analytics
    "Get comprehensive track analytics and statistics"
    trackStats(trackId: ID!, year: Int, seriesId: String): TrackAnalytics
    
    # Practice session queries
    "Get practice sessions for a specific race"
    practiceSessions(eventId: ID!): [PracticeSession]
    "Get fastest practice times across sessions"
    fastestPracticeTimes(eventId: ID!, limit: Int = 10): [PracticeResult]
  }
`;
