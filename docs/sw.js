/*
{
    288a4e95-7c10-41bd-ad04-b04dec86730a: <zip>,
    ...
}
 */
const mapClientToZip = new Map();

const EXTENSION_TO_MIME = {
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'webp': 'image/webp',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'txt': 'text/plain',
    'xml': 'application/xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
};


/**
 *
 */
const run = () => {
    self.importScripts('./jszip.min.js');
    self.addEventListener('install', onInstall);
    self.addEventListener('activate', onActivate);
    self.addEventListener('message', onMessageFromClient);
    self.addEventListener('fetch', onFetch);
}

/**
 *
 */
const onInstall = (event) => {
    // console.log('onInstall:');
    event.waitUntil(self.skipWaiting());
}

/**
 *
 */
const onActivate = (event) => {
    // console.log('onActivate:');
    event.waitUntil(self.clients.claim());
}

/**
 *
 */
const onMessageFromClient = async (event) => {
    const {source, data = {}} = event;
    if (data.type !== 'RECEIVE_BLOB') {
        return;
    }

    // Remove stale clients:
    await pruneMap();

    // Parse the blob and store it:
    const zipBlob = event.data.blob;
    const zip = await JSZip.loadAsync(zipBlob);
    mapClientToZip.set(source.id, zip);
    console.log('source.id:', source.id);

    // Announce the entry path:
    const htmlPath = source.id + '/' + chooseHtmlPath(zip);
    source.postMessage({type: 'RECEIVE_HTML_PATH', htmlPath});
}

/**
 *
 */
const pruneMap = async () => {
    const aliveClients = await self.clients.matchAll({ includeUncontrolled: true });
    const aliveIds = new Set(aliveClients.map(c => c.id));
    for (const clientId of mapClientToZip.keys()) {
        if (!aliveIds.has(clientId)) {
            mapClientToZip.delete(clientId);
        }
    }
}

/**
 *
 */
const chooseHtmlPath = (zip) => {
    const htmlPaths = [];
    zip.forEach((relativePath, file) => {
        if (!file.dir && relativePath.toLowerCase().endsWith('.html')) {
            htmlPaths.push(relativePath);
        }
    });
    for (const path of htmlPaths) {
        if (path === 'index.html' || path.endsWith('/index.html')) {
            return path;
        }
    }
    return htmlPaths[0];
}

/**
 *
 */
const onFetch = (event) => {
    const {url} = event.request; // e.g. http://localhost:8000/269508e5-f9b6-47ae-b803-f7bbb8c8771e/index.html
    const {scope} = self.registration; // e.g. http://localhost:8000/
    if (!url.startsWith(scope)) {
        return;
    }

    const relativeUrl = url.substring(scope.length); // e.g. 269508e5-f9b6-47ae-b803-f7bbb8c8771e/index.html
    const parts = relativeUrl.split('/');
    const clientId = parts[0]; // e.g. 269508e5-f9b6-47ae-b803-f7bbb8c8771e
    const zip = mapClientToZip.get(clientId);
    if (!zip) {
        return;
    }

    parts.shift();
    const pathInZip = parts.join('/').trim() || 'index.html'; // e.g. index.html
    // console.log('pathInZip:', pathInZip);

    // noinspection JSVoidFunctionReturnValueUsed
    const zipEntry = zip.file(pathInZip);
    if (zipEntry) {
        event.respondWith(respondWithZipEntry(zipEntry));
    } else {
        event.respondWith(new Response(`Not found`, { status: 404 }));
    }
};

/**
 *
 */
const respondWithZipEntry = async (zipEntry) => {
    try {
        const contentBlob = await zipEntry.async('blob');
        return new Response(contentBlob, {
            headers: {
                'Content-Type': getMimeType(zipEntry.name)
            }
        });
    } catch (err) {
        return new Response(`Error reading`, { status: 404 });
    }
}

/**
 *
 */
const getMimeType = (filePath) => {
    const extension = filePath.split('.').pop().toLowerCase();
    return EXTENSION_TO_MIME[extension] || 'application/octet-stream';
}

run();