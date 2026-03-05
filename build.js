const fs = require('fs');
fs.cpSync('public', 'dist', { recursive: true });
console.log('Build complete: public -> dist');
