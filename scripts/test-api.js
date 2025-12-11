#!/usr/bin/env node

/**
 * Test Script for Spooled API
 *
 * This script helps test the API integration by:
 * 1. Creating a test organization (if in open registration mode)
 * 2. Testing login functionality
 * 3. Fetching dashboard data
 *
 * Usage:
 *   node scripts/test-api.js
 */

const API_URL = process.env.PUBLIC_API_URL || 'https://api.spooled.cloud';
const ADMIN_API_KEY = 'CCvwgbl3UYHzAsJQFsVkOL4XoRT0GyLZL46xz3WA0';

async function testAPI() {
  console.log('🧪 Testing Spooled API Integration\n');
  console.log(`API URL: ${API_URL}\n`);

  try {
    // Test 1: Health Check
    console.log('1️⃣  Testing health endpoint...');
    const healthRes = await fetch(`${API_URL}/health`);
    const health = await healthRes.json();
    console.log('✅ Health check passed:', health);
    console.log('   Version:', health.version);
    console.log('   Uptime:', Math.floor(health.uptime_seconds / 60), 'minutes\n');

    // Test 2: Create Organization (with admin key)
    console.log('2️⃣  Creating test organization...');
    const orgData = {
      name: 'Test Organization',
      slug: 'test-org-' + Date.now(),
      billing_email: 'test@spooled.cloud',
    };

    const orgRes = await fetch(`${API_URL}/api/v1/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_API_KEY,
      },
      body: JSON.stringify(orgData),
    });

    if (orgRes.ok) {
      const org = await orgRes.json();
      console.log('✅ Organization created:', org.name);
      console.log('   ID:', org.id);
      console.log('   Slug:', org.slug);
      console.log('\n   🔑 Save this organization ID for later:', org.id, '\n');
    } else if (orgRes.status === 403) {
      console.log('⚠️  Organization creation requires admin key (closed registration mode)');
      console.log('   This is expected for SaaS deployments.\n');
    } else {
      const error = await orgRes.text();
      console.log('❌ Failed to create organization:', orgRes.status, error, '\n');
    }

    // Test 3: Dashboard endpoint (requires auth, so this will fail without login)
    console.log('3️⃣  Testing dashboard endpoint (unauthenticated)...');
    const dashRes = await fetch(`${API_URL}/api/v1/dashboard`);
    console.log('   Status:', dashRes.status);
    if (dashRes.status === 401) {
      console.log('✅ Correctly requires authentication\n');
    } else if (dashRes.ok) {
      const data = await dashRes.json();
      console.log('✅ Dashboard data received');
      console.log('   Total jobs:', data.job_statistics?.total || 0);
      console.log('   Active workers:', data.worker_status?.active || 0, '\n');
    }

    console.log('✨ API tests completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Use the organization ID above to create users/API keys');
    console.log('   2. Login via the dashboard UI');
    console.log('   3. Start creating jobs and queues\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAPI();
