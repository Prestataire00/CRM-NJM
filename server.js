/**
 * Serveur local pour le CRM NJM Conseil
 * Lance avec: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = 'localhost';

// Types MIME pour les fichiers
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
    // Décoder l'URL et gérer la racine
    let filePath = decodeURIComponent(req.url);
    if (filePath === '/') {
        filePath = '/index.html';
    }

    // Construire le chemin complet
    const fullPath = path.join(__dirname, filePath);

    // Vérifier que le fichier existe
    fs.stat(fullPath, (err, stats) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 - Fichier non trouvé</h1><p>Le fichier demandé n\'existe pas.</p>');
            console.log(`❌ 404: ${filePath}`);
            return;
        }

        // Si c'est un dossier, chercher index.html
        if (stats.isDirectory()) {
            const indexPath = path.join(fullPath, 'index.html');
            fs.readFile(indexPath, (err, content) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h1>404 - Pas d\'index</h1>');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
            });
            return;
        }

        // Déterminer le type MIME
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        // Lire et envoyer le fichier
        fs.readFile(fullPath, (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>500 - Erreur serveur</h1>');
                console.log(`❌ 500: ${filePath} - ${err.message}`);
                return;
            }

            // Headers CORS pour Supabase
            res.writeHead(200, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end(content);
            console.log(`✅ 200: ${filePath}`);
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║          🚀 CRM NJM Conseil - Serveur Local        ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  Serveur démarré sur: http://${HOST}:${PORT}          ║`);
    console.log('║                                                    ║');
    console.log('║  Ouvrez votre navigateur à cette adresse           ║');
    console.log('║  Pour arrêter: Ctrl+C                              ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Requêtes:');
});
