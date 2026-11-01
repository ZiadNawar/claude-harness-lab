// A node:test reporter that prints one JSON line per finished test, for check.mjs.

export default async function* reporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const { name, nesting, details } = event.data;
    if (nesting !== 0 || details?.type === 'suite') continue;
    yield `\n${JSON.stringify({ walq: { name, ok: event.type === 'test:pass' } })}\n`;
  }
}
