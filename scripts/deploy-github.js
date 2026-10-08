const fs = require('fs');
const path = require('path');
const readline = require('readline');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

const repoDir = path.resolve(__dirname, '..');
const REPO_OWNER = 'yashliveinsaan';
const REPO_NAME = 'ai-travel-agent';
const REMOTE_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}.git`;

async function promptToken() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n🔑 Enter your GitHub Personal Access Token (PAT) [classic or fine-grained]: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('====================================================');
  console.log(`🚀 Deploying AI Travel Agent to GitHub: ${REPO_OWNER}/${REPO_NAME}`);
  console.log('====================================================');

  let token = process.argv[2] || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!token && fs.existsSync(path.join(repoDir, '.env.local'))) {
    const envContent = fs.readFileSync(path.join(repoDir, '.env.local'), 'utf-8');
    const match = envContent.match(/GITHUB_TOKEN=([^\r\n]+)/);
    if (match && match[1]) {
      token = match[1].trim();
      console.log('✓ Found GITHUB_TOKEN in .env.local');
    }
  }

  if (!token) {
    if (process.stdin.isTTY) {
      token = await promptToken();
    }
  }

  if (!token) {
    console.log('\n❌ No GitHub Token provided.');
    console.log('\nTo deploy to GitHub, you need a Personal Access Token with "repo" scope:');
    console.log('1. Visit: https://github.com/settings/tokens/new');
    console.log('2. Note: "ai-travel-agent deploy"');
    console.log('3. Select scope: [x] repo (Full control of private repositories)');
    console.log('4. Click "Generate token" and copy the token (starts with ghp_...)');
    console.log('\nThen run:');
    console.log('   npm run deploy -- <YOUR_GITHUB_TOKEN>');
    console.log('   OR');
    console.log('   set GITHUB_TOKEN=your_token && npm run deploy');
    process.exit(1);
  }

  console.log(`\n📦 Target Remote: ${REMOTE_URL}`);
  console.log('⏳ Pushing main branch to GitHub...');

  try {
    const pushResult = await git.push({
      fs,
      http,
      dir: repoDir,
      remote: 'origin',
      ref: 'main',
      force: false,
      onAuth: () => ({
        username: token,
        password: ''
      })
    });

    console.log('\n🎉 SUCCESS! Application deployed successfully to GitHub!');
    console.log(`🔗 Repository URL: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
    console.log(`🌿 Branch: main`);
  } catch (error) {
    if (error.code === 'HttpError' && error.data && error.data.statusCode === 401) {
      console.error('\n❌ Authentication failed: Invalid token or expired permissions.');
      console.error('Please verify your token has "repo" permissions at https://github.com/settings/tokens');
    } else if (error.code === 'HttpError' && error.data && error.data.statusCode === 404) {
      console.error(`\n❌ Repository not found at https://github.com/${REPO_OWNER}/${REPO_NAME}`);
      console.error('If you have not created the repository on GitHub yet, please create it at:');
      console.error(`👉 https://github.com/new?name=${REPO_NAME}&owner=${REPO_OWNER}`);
      console.error('Then re-run this script to push your code.');
    } else {
      console.error('\n❌ Push error:', error.message || error);
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
