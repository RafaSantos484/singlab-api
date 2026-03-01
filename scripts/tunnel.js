/**
 * Tunnel script to expose local server using ngrok CLI
 * Reads PORT from environment variable (defaults to 5001)
 */

const { spawn } = require('child_process');
const dotenv = require('dotenv');
const path = require('path');

// Determine environment and load appropriate .env file
const nodeEnv = process.env.NODE_ENV || 'local';
const envFile = `.env.${nodeEnv}`;
const envPath = path.resolve(__dirname, '..', envFile);

// Load environment variables
dotenv.config({ path: envPath });

// Get port from environment or use default
const port = process.env.PORT || 5001;

console.log(`Starting ngrok tunnel for port ${port}...`);
console.log(`Environment: ${nodeEnv}`);
console.log(`Env file: ${envFile}`);
console.log('');

// Spawn ngrok process
const ngrok = spawn('ngrok', ['http', port.toString()], {
  stdio: 'inherit',
  shell: true,
});

// Handle process exit
ngrok.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`\n✗ ngrok process exited with code ${code}`);
    console.error('');
    console.error('Common issues:');
    console.error('  1. ngrok not installed - Install: npm install -g ngrok');
    console.error('  2. ngrok auth token not configured');
    console.error(
      '     Get token: https://dashboard.ngrok.com/get-started/your-authtoken',
    );
    console.error('     Configure: ngrok config add-authtoken YOUR_TOKEN');
    console.error(
      '  3. Port already in use or server not running on port ' + port,
    );
    console.error('');
  }
  process.exit(code || 0);
});

// Handle errors
ngrok.on('error', (error) => {
  console.error('\n✗ Failed to start ngrok:');
  console.error(`  ${error.message}`);
  console.error('');
  console.error('Make sure ngrok is installed:');
  console.error('  npm install -g ngrok');
  console.error('');
  process.exit(1);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nClosing ngrok tunnel...');
  ngrok.kill('SIGINT');
});
