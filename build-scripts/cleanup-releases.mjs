import https from 'https';

const OWNER = 'ClueMaster-LLC';
const ALL_REPOS = ['TimerDisplay-Updates-Dev', 'TimerDisplay-Updates'];
const KEEP_COUNT = 3;

// Get repo from command line argument
const targetRepo = process.argv[2];

if (!targetRepo) {
  console.error('❌ Error: Repository name required. Usage: node cleanup-releases.mjs <repo-name|ALL>');
  process.exit(1);
}

// Get GitHub token from environment
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ Error: GitHub token not found. Set GH_TOKEN or GITHUB_TOKEN environment variable.');
  process.exit(1);
}

async function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : null);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getReleases(repo) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${repo}/releases`,
    method: 'GET',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'Node.js',
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  return makeRequest(options);
}

async function deleteRelease(repo, releaseId) {
  const options = {
    hostname: 'api.github.com',
    path: `/repos/${OWNER}/${repo}/releases/${releaseId}`,
    method: 'DELETE',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'Node.js',
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  return makeRequest(options);
}

async function cleanupRepo(repo) {
  console.log(`\n🔍 Checking releases in ${repo}...`);

  try {
    const releases = await getReleases(repo);
    
    if (!releases || releases.length === 0) {
      console.log(`   No releases found in ${repo}`);
      return;
    }

    // Sort by creation date (newest first)
    releases.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log(`   Found ${releases.length} releases`);

    if (releases.length <= KEEP_COUNT) {
      console.log(`   ✅ Keeping all ${releases.length} releases (${KEEP_COUNT} or fewer)`);
      return;
    }

    // Keep the first KEEP_COUNT, delete the rest
    const toKeep = releases.slice(0, KEEP_COUNT);
    const toDelete = releases.slice(KEEP_COUNT);

    console.log(`   ✅ Keeping latest ${KEEP_COUNT} releases:`);
    toKeep.forEach(r => console.log(`      - ${r.tag_name} (${r.name || 'unnamed'})`));

    console.log(`   🗑️  Deleting ${toDelete.length} old releases:`);
    
    for (const release of toDelete) {
      try {
        await deleteRelease(repo, release.id);
        console.log(`      ✓ Deleted ${release.tag_name} (${release.name || 'unnamed'})`);
      } catch (error) {
        console.error(`      ✗ Failed to delete ${release.tag_name}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Error processing ${repo}: ${error.message}`);
  }
}

async function main() {
  console.log('\n🧹 Starting release cleanup...\n');
  
  if (targetRepo === 'ALL') {
    for (const repo of ALL_REPOS) {
      await cleanupRepo(repo);
    }
    console.log('\n✅ All repositories cleaned up!\n');
  } else {
    await cleanupRepo(targetRepo);
    console.log('\n✅ Cleanup complete!\n');
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
