// Keeps a plain read handle on a file for a while, the way a backup agent, a virus
// scanner or `walq tail` would. Writes the marker once the handle is open.

import fs from 'node:fs';

const [file, holdMs, marker] = process.argv.slice(2);

process.on('disconnect', () => process.exit(0));

const fd = fs.openSync(file, 'r');
fs.writeFileSync(marker, 'open');
setTimeout(() => {
  fs.closeSync(fd);
  process.exit(0);
}, Number(holdMs));
