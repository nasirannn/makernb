#!/usr/bin/env npx tsx

/**
 * Test IndexNow Integration
 *
 * This script tests if IndexNow is working correctly by submitting test URLs
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'a6aae107e81f4596bf98f78cf0f05672';
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://makernb.com';

async function testIndexNow() {
  console.log('🧪 Testing IndexNow Integration\n');
  console.log('Configuration:');
  console.log(`  Site URL: ${SITE_URL}`);
  console.log(`  Key: ${INDEXNOW_KEY}`);
  console.log(`  Key Location: ${SITE_URL}/${INDEXNOW_KEY}.txt\n`);

  // Step 1: Verify key file is accessible
  console.log('Step 1: Verifying key file accessibility...');
  try {
    const keyUrl = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
    const keyResponse = await fetch(keyUrl);

    if (keyResponse.ok) {
      const keyContent = await keyResponse.text();
      if (keyContent.trim() === INDEXNOW_KEY) {
        console.log('✅ Key file is accessible and valid\n');
      } else {
        console.error('❌ Key file content does not match!');
        console.error(`   Expected: ${INDEXNOW_KEY}`);
        console.error(`   Got: ${keyContent.trim()}\n`);
        return;
      }
    } else {
      console.error(`❌ Key file not accessible (HTTP ${keyResponse.status})\n`);
      return;
    }
  } catch (error) {
    console.error('❌ Error accessing key file:', error);
    return;
  }

  // Step 2: Submit test URLs to IndexNow
  console.log('Step 2: Submitting test URLs to IndexNow...');

  const testUrls = [
    `${SITE_URL}`,
    `${SITE_URL}/explore`,
  ];

  console.log('URLs to submit:');
  testUrls.forEach(url => console.log(`  - ${url}`));
  console.log();

  try {
    const host = new URL(SITE_URL).host;
    const payload = {
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: testUrls,
    };

    console.log('Sending request to IndexNow API...');
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log('✅ IndexNow submission successful!\n');
      console.log('What happens next:');
      console.log('1. Search engines (Bing, Yandex) have been notified');
      console.log('2. They will crawl the URLs soon (usually within hours)');
      console.log('3. Check Bing Webmaster Tools to see the submission history');
      console.log('4. Note: This does NOT guarantee immediate indexing\n');
    } else {
      const errorText = await response.text();
      console.error('❌ IndexNow submission failed!');
      console.error(`   Status: ${response.status}`);
      console.error(`   Response: ${errorText}\n`);

      // Provide helpful error messages
      if (response.status === 403) {
        console.error('💡 403 Forbidden - Check if your key file is accessible');
      } else if (response.status === 400) {
        console.error('💡 400 Bad Request - Check the payload format');
      } else if (response.status === 422) {
        console.error('💡 422 Unprocessable Entity - Check if URLs are valid');
      }
    }
  } catch (error) {
    console.error('❌ Error submitting to IndexNow:', error);
  }

  console.log('\n📋 Verification Steps:');
  console.log('1. Go to https://www.bing.com/webmasters');
  console.log('2. Add/verify your site');
  console.log('3. Check "URL Submission" → "IndexNow" section');
  console.log('4. You should see submission history there\n');
}

// Run the test
testIndexNow()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
