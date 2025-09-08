/**
 * Users and Teams Seeder
 * Creates sample users, teams, and API keys for development and testing
 */

import bcrypt from 'bcrypt';
import { PoolClient } from 'pg';
import { Seeder } from '../database-seeder';

export const seeder: Seeder = {
  name: 'users-and-teams',
  description: 'Create sample users, teams, and API keys',
  priority: 1,
  environments: ['development', 'testing'],
  dependencies: [],

  async run(client: PoolClient): Promise<void> {
    /** Hash passwords for test users */
    const passwordHash = await bcrypt.hash('password123', 10);

    /** Create test users */
    const users = [
      {
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        tier: 'enterprise',
        isVerified: true
      },
      {
        email: 'pro@example.com',
        username: 'prouser',
        firstName: 'Pro',
        lastName: 'User',
        tier: 'pro',
        isVerified: true
      },
      {
        email: 'free@example.com',
        username: 'freeuser',
        firstName: 'Free',
        lastName: 'User',
        tier: 'free',
        isVerified: true
      },
      {
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        tier: 'free',
        isVerified: false
      }
    ];

    console.log('Creating test users...');
    const createdUsers: Array<{ id: string; email: string; tier: string }> = [];

    for (const user of users) {
      const result = await client.query(`
        INSERT INTO users (email, username, password_hash, first_name, last_name, tier, is_verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email, tier
      `, [
        user.email,
        user.username,
        passwordHash,
        user.firstName,
        user.lastName,
        user.tier,
        user.isVerified
      ]);

      createdUsers.push(result.rows[0]);
      console.log(`  ✅ Created user: ${user.email} (${user.tier})`);
    }

    /** Create test teams */
    const teams = [
      {
        name: 'Development Team',
        description: 'Main development team',
        tier: 'enterprise',
        maxMembers: 20
      },
      {
        name: 'API Testing Team',
        description: 'Team for API testing and QA',
        tier: 'pro',
        maxMembers: 10
      },
      {
        name: 'Free Tier Team',
        description: 'Sample free tier team',
        tier: 'free',
        maxMembers: 5
      }
    ];

    console.log('Creating test teams...');
    const createdTeams: Array<{ id: string; name: string; tier: string }> = [];

    for (const team of teams) {
      const result = await client.query(`
        INSERT INTO teams (name, description, tier, max_members)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, tier
      `, [team.name, team.description, team.tier, team.maxMembers]);

      createdTeams.push(result.rows[0]);
      console.log(`  ✅ Created team: ${team.name} (${team.tier})`);
    }

    /** Create team memberships */
    console.log('Creating team memberships...');
    
    /** Admin user owns all teams */
    const adminUser = createdUsers.find(u => u.email === 'admin@example.com');
    if (adminUser) {
      for (const team of createdTeams) {
        await client.query(`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `, [team.id, adminUser.id]);
        
        console.log(`  ✅ Added ${adminUser.email} as owner of ${team.name}`);
      }
    }

    /** Pro user is member of development and testing teams */
    const proUser = createdUsers.find(u => u.email === 'pro@example.com');
    if (proUser) {
      const devTeam = createdTeams.find(t => t.name === 'Development Team');
      const testTeam = createdTeams.find(t => t.name === 'API Testing Team');
      
      if (devTeam) {
        await client.query(`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES ($1, $2, 'admin')
        `, [devTeam.id, proUser.id]);
        console.log(`  ✅ Added ${proUser.email} as admin of ${devTeam.name}`);
      }
      
      if (testTeam) {
        await client.query(`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES ($1, $2, 'member')
        `, [testTeam.id, proUser.id]);
        console.log(`  ✅ Added ${proUser.email} as member of ${testTeam.name}`);
      }
    }

    /** Free user is member of free team */
    const freeUser = createdUsers.find(u => u.email === 'free@example.com');
    if (freeUser) {
      const freeTeam = createdTeams.find(t => t.name === 'Free Tier Team');
      if (freeTeam) {
        await client.query(`
          INSERT INTO team_members (team_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `, [freeTeam.id, freeUser.id]);
        console.log(`  ✅ Added ${freeUser.email} as owner of ${freeTeam.name}`);
      }
    }

    /** Create sample API keys */
    console.log('Creating sample API keys...');
    
    const apiKeys = [
      {
        userId: adminUser?.id,
        name: 'Admin Development Key',
        keyPrefix: 'ak_admin',
        permissions: ['read', 'write', 'admin'],
        rateLimitPerHour: 10000
      },
      {
        userId: proUser?.id,
        name: 'Pro API Key',
        keyPrefix: 'ak_pro',
        permissions: ['read', 'write'],
        rateLimitPerHour: 5000
      },
      {
        userId: freeUser?.id,
        name: 'Free API Key',
        keyPrefix: 'ak_free',
        permissions: ['read'],
        rateLimitPerHour: 1000
      }
    ];

    for (const apiKey of apiKeys) {
      if (!apiKey.userId) continue;

      /** Generate a sample API key hash (in real scenario, this would be a proper hash) */
      const keyValue = `${apiKey.keyPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const keyHash = await bcrypt.hash(keyValue, 10);

      await client.query(`
        INSERT INTO api_keys (user_id, name, key_hash, key_prefix, permissions, rate_limit_per_hour)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        apiKey.userId,
        apiKey.name,
        keyHash,
        apiKey.keyPrefix,
        JSON.stringify(apiKey.permissions),
        apiKey.rateLimitPerHour
      ]);

      console.log(`  ✅ Created API key: ${apiKey.name} (${keyValue})`);
    }

    /** Create team API keys */
    const devTeam = createdTeams.find(t => t.name === 'Development Team');
    if (devTeam) {
      const teamKeyValue = `ak_team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const teamKeyHash = await bcrypt.hash(teamKeyValue, 10);

      await client.query(`
        INSERT INTO api_keys (team_id, name, key_hash, key_prefix, permissions, rate_limit_per_hour)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        devTeam.id,
        'Team Development Key',
        teamKeyHash,
        'ak_team',
        JSON.stringify(['read', 'write']),
        15000
      ]);

      console.log(`  ✅ Created team API key: Team Development Key (${teamKeyValue})`);
    }

    console.log('\n🎉 Users and teams seeding completed!');
    console.log('\nTest Accounts Created:');
    console.log('├── admin@example.com (password: password123) - Enterprise tier');
    console.log('├── pro@example.com (password: password123) - Pro tier');
    console.log('├── free@example.com (password: password123) - Free tier');
    console.log('└── test@example.com (password: password123) - Free tier (unverified)');
  },

  async rollback(client: PoolClient): Promise<void> {
    console.log('Rolling back users and teams seeder...');
    
    /** Delete in reverse dependency order */
    await client.query('DELETE FROM api_key_usage WHERE api_key_id IN (SELECT id FROM api_keys)');
    await client.query('DELETE FROM api_keys WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%@example.com\') OR team_id IN (SELECT id FROM teams WHERE name LIKE \'%Team\')');
    await client.query('DELETE FROM team_members WHERE user_id IN (SELECT id FROM users WHERE email LIKE \'%@example.com\')');
    await client.query('DELETE FROM teams WHERE name LIKE \'%Team\'');
    await client.query('DELETE FROM users WHERE email LIKE \'%@example.com\'');
    
    console.log('✅ Users and teams rollback completed');
  }
};

export default seeder;
