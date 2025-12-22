const fs = require('fs');
const vm = require('vm');
const s = fs.readFileSync('js/script.js', 'utf8');
const lines = s.split('\n');
let lo = 1, hi = lines.length, bad = 0;
while (lo <= hi) {
	const mid = Math.floor((lo + hi) / 2);
	const chunk = lines.slice(0, mid).join('\n');
	try {
		new vm.Script(chunk);
		lo = mid + 1;
	} catch (e) {
		bad = mid;
		hi = mid - 1;
	}
}
if (bad) {
	console.log('First failing line:', bad);
	const contextStart = Math.max(0, bad - 10);
	const contextEnd = Math.min(lines.length, bad + 10);
	for (let i = contextStart; i < contextEnd; i++) {
		console.log((i + 1) + ':' + lines[i]);
	}
	try {
		new vm.Script(lines.slice(0, bad).join('\n'));
	} catch (err) {
		console.log('Parser message:', err && err.message);
	}
} else {
	console.log('No failure found with vm.Script');
}