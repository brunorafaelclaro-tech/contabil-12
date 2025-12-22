const fs = require('fs');
const s = fs.readFileSync('js/script.js', 'utf8');
const upTo = s.split('\n').slice(0,1064).join('\n');
const count = (upTo.match(/`/g) || []).length;
console.log('Backticks up to error:', count);
const total = (s.match(/`/g) || []).length;
console.log('Total backticks in file:', total);