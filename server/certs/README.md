# Dev certificates for WSS

Place a development key/certificate here to enable WSS in local development.

Environment variables read by the backend (server/universal-server.js):
- HTTPS_KEY_FILE: absolute or relative path to the private key file (PEM)
- HTTPS_CERT_FILE: absolute or relative path to the certificate file (PEM)

Quick options:
1) OpenSSL (PowerShell)
   openssl req -x509 -newkey rsa:2048 -nodes -keyout dev.key -out dev.crt -days 365 -subj "/CN=localhost"
   # Then set: HTTPS_KEY_FILE=server/certs/dev.key, HTTPS_CERT_FILE=server/certs/dev.crt

2) Using mkcert (recommended)
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   # Rename output to dev.crt/dev.key or update envs accordingly.

After placing files, start the backend with these envs to get 🔐 WSS on WS_PORT (default 8080).
