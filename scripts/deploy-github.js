const fs = require('fs');
const path = require('path');
const readline = require('readline');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

const repoDir = path.resolve(__dirname, '..');
const REPO_OWNER = 'yashliveinsaan';
const REPO_NAME = 'Wayvo';
const REMOTE_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}.git`;

async function promptToken() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n🔑 Enter your GitHub Personal Access Token (PAT): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('====================================================');
  console.log(`🚀 Deploying Wayvo to GitHub: ${REPO_OWNER}/${REPO_NAME}`);
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
    console.log('\nRun:');
    console.log('   npm run deploy -- <YOUR_GITHUB_TOKEN>');
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
      force: true,
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
    } else if (error.code === 'HttpError' && error.data && error.data.statusCode === 404) {
      console.error(`\n❌ Repository not found at https://github.com/${REPO_OWNER}/${REPO_NAME}`);
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
