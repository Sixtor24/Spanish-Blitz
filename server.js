import('./build/server/index.js')
  .then((build) => {
    const server = build.default;
    const PORT = process.env.PORT || 4000;

    console.log(`🚀 Server starting on port ${PORT}...`);

    if (server && typeof server.listen === 'function') {
      server.listen(PORT, () => {
        console.log(`✅ Server running at http://localhost:${PORT}`);
      });
    } else {
      console.error('❌ Server export not found or invalid');
      console.error('Available exports:', Object.keys(build));
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Failed to load server:', error);
    process.exit(1);
  });

