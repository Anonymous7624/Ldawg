const argon2 = require('argon2');

const password = 'Password/3285';

async function generateHash() {
  try {
    console.log('='.repeat(60));
    console.log('Password Hash Generator');
    console.log('='.repeat(60));
    console.log(`Password: ${password}`);
    console.log('Generating hash...');
    
    const hash = await argon2.hash(password);
    
    console.log('');
    console.log('Generated Hash:');
    console.log(hash);
    console.log('');
    console.log('='.repeat(60));
    console.log('Use this hash to update the passHash field in MongoDB');
    console.log('='.repeat(60));
    
    process.exit(0);
  } catch (error) {
    console.error('Error generating hash:', error);
    process.exit(1);
  }
}

generateHash();
