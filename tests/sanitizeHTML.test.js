const assert = require('assert');

function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

const input = '<>&"\\\'';
const expected = '&lt;&gt;&amp;&quot;\\&#39;';

assert.strictEqual(sanitizeHTML(input), expected);

console.log('sanitizeHTML passed');
