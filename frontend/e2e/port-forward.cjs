/**
 * Forward localhost ports to Docker service hostnames.
 *
 * Chromium only exposes crypto.subtle in "secure contexts" (HTTPS or localhost).
 * Inside the e2e Docker container, the frontend is at http://frontend:5173 which
 * is not localhost, so crypto.subtle is unavailable. This script forwards
 * localhost:<port> -> <service>:<port> so the browser can use http://localhost:5173.
 */

const net = require("net");

const forwards = [
  { local: 5173, remote: "frontend", remotePort: 5173 },
  { local: 8000, remote: "api", remotePort: 8000 },
  { local: 8025, remote: "mailpit", remotePort: 8025 },
  { local: 1025, remote: "mailpit", remotePort: 1025 },
];

for (const { local, remote, remotePort } of forwards) {
  const server = net.createServer((socket) => {
    const upstream = net.connect(remotePort, remote);
    socket.pipe(upstream).pipe(socket);
    socket.on("error", () => upstream.destroy());
    upstream.on("error", () => socket.destroy());
  });
  server.listen(local, "127.0.0.1", () => {
    console.log(`  ${local} -> ${remote}:${remotePort}`);
  });
}

console.log("Port forwards active. Press Ctrl+C to stop.");
