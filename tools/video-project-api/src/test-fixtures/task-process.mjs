process.on('message', ({ id, name }) => {
  if (name === 'render') {
    process.send({ id, progress: ['Rendering', 25] });
    const end = Date.now() + 500;
    while (Date.now() < end) { /* Simulate CPU-bound rendering. */ }
  }
  if (name === 'voice') {
    process.send({ id, error: { message: 'VOICE_RESOURCE_LIMIT fixture' } });
    return;
  }
  if (name === 'alignment') process.exit(2);
  process.send({ id, result: { ok: true } });
});
process.once('disconnect', () => process.exit(0));
