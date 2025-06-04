// Import JSZip (assuming jszip.min.js is in the same directory or accessible)
self.importScripts('./jszip.min.js'); // Adjust path if necessary

let zipFs = null; // This will hold the JSZip instance
const VFS_PREFIX = './vfs/'; // Requests starting with this will be served from ZIP

console.log('Service Worker loading...');

self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    // Force the waiting service worker to become the active service worker.
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    // Take control of all clients as soon as the SW is activated.
    event.waitUntil(self.clients.claim());
    console.log('Service Worker activated and claimed clients.');
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'INIT_VFS') {
        console.log('Service Worker received INIT_VFS message with blob.');
        const zipBlob = event.data.blob;
        JSZip.loadAsync(zipBlob)
            .then(zip => {
                zipFs = zip;
                console.log('ZIP file loaded and ready in Service Worker.');
                console.log('zipFs in load:', zipFs);
                // Optionally, notify clients that VFS is ready
                self.clients.matchAll().then(clients => {
                    clients.forEach(client => client.postMessage({ type: 'VFS_READY' }));
                });
            })
            .catch(err => {
                console.error('Failed to load ZIP file in Service Worker:', err);
                zipFs = null;
            });
    }
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    console.log('event.request.url:', event.request.url);

    // Check if the request URL starts with our VFS_PREFIX relative to the SW scope
    // The SW's scope is './', so event.request.url will be like 'http://localhost:xxxx/vfs/file.txt'
    // We need to compare the pathname part.
    console.log('url.pathname:', url.pathname);
    console.log('self.registration.scope:', self.registration.scope);
    console.log('VFS_PREFIX:', VFS_PREFIX);
    if (url.pathname.includes('/vfs/')) {
        console.log('zipFs in fetch:', zipFs);
        if (!zipFs) {
            console.warn('Fetch event for VFS, but ZIP not loaded yet. Request URL:', event.request.url);
            // Respond with a 503 Service Unavailable or a temporary message
            event.respondWith(
                new Response('Virtual File System not ready. Please wait or refresh.', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 'Content-Type': 'text/plain' }
                })
            );
            return;
        }

        // Extract the path within the ZIP
        const pathInZip = 'image.svg';
        console.log(`Service Worker intercepting: ${event.request.url}, Path in ZIP: '${pathInZip}'`);

        const zipEntry = zipFs.file(pathInZip);

        if (zipEntry) {
            console.log(`Found in ZIP: ${pathInZip}`);
            event.respondWith(
                zipEntry.async('blob') // Or 'string', 'arraybuffer', 'nodebuffer'
                    .then(contentBlob => {
                        const mimeType = getMimeType(pathInZip);
                        console.log(`Serving ${pathInZip} with MIME type ${mimeType}`);
                        return new Response(contentBlob, {
                            headers: {
                                'Content-Type': mimeType,
                                // Add any other headers like Content-Length if known and needed
                                // 'Content-Length': contentBlob.size // Example
                            }
                        });
                    })
                    .catch(err => {
                        console.error(`Error reading ${pathInZip} from ZIP:`, err);
                        return new Response(`File not found or error reading: ${pathInZip}`, { status: 404 });
                    })
            );
        } else {
            console.warn(`File not found in ZIP: ${pathInZip}`);
            event.respondWith(new Response(`File not found in VFS: ${pathInZip}`, { status: 404 }));
        }
    } else {
        // Not a VFS request, let the browser handle it normally
        console.log('Service Worker passing through:', event.request.url);
        // No event.respondWith() means default browser behavior
    }
});

function getMimeType(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    switch (extension) {
        case 'txt': return 'text/plain';
        case 'html': return 'text/html';
        case 'css': return 'text/css';
        case 'js': return 'application/javascript';
        case 'json': return 'application/json';
        case 'png': return 'image/png';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'svg': return 'image/svg+xml';
        default: return 'application/octet-stream';
    }
}