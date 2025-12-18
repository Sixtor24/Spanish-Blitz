import server from './__create/index.ts';

const PORT = process.env.PORT || 4000;

console.log(`🚀 Server starting on port ${PORT}...`);

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

