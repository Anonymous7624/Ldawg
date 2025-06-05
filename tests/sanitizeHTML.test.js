const assert = require('assert');

function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
}

assert.strictEqual(
  sanitizeHTML('<>&"\''),
  '&lt;&gt;&amp;&quot;&#39;'
);

console.log('All tests passed!');
