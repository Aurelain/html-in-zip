/**
 *
 */
const main = async () => {
    await startServiceWorker();
    if (location.search) {
        await load(location.search.substring(1));
        return;
    }
    document.addEventListener('dragover', onDocumentDragOver);
    document.addEventListener('dragleave', onDocumentDragLeave);
    document.addEventListener('drop', onDocumentDrop);
};

/**
 *
 */
const onDocumentDragOver = (event) => {
    console.log('onDocumentDragOver:', event);

};

/**
 *
 */
const onDocumentDragLeave = (event) => {
    console.log('onDocumentDragLeave:', event);

};

/**
 *
 */
const onDocumentDrop = (event) => {
    console.log('onDocumentDrop:', event);

};

/**
 *
 */
const load = async (url) => {
    const response = await fetch(url);
    navigator.serviceWorker.addEventListener('message', onMessageFromSW);
    navigator.serviceWorker.controller.postMessage({
         type: 'RECEIVE_BLOB',
         blob: await response.blob(),
    });
};

/**
 *
 */
const onMessageFromSW = (event) => {
    const {data = {}} = event;
    if (data.type !== 'RECEIVE_HTML_PATH') {
        return;
    }
    console.log(`onMessageFromSW @ ${location.search}:`, data);
    document.body.innerHTML = `
        <iframe src='${data.htmlPath}' allowfullscreen></iframe>
    `;

};

/**
 *
 */
const startServiceWorker = async () => {
    const registration = await navigator.serviceWorker.register('./sw.js', {scope: './'});

    // Ensure it's activated:
    const sw = registration.installing || registration.waiting || registration.active;
    if (sw.state !== 'activated') {
        await new Promise((resolve) => {
            const onStateChange = () => {
                if (sw.state === 'activated') {
                    sw.removeEventListener('statechange', onStateChange);
                    resolve();
                }
            }
            sw.addEventListener('statechange', onStateChange);
        });
    }

    // Ensure it is controlling:
    if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
            const onControllerChange = () => {
                navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
                resolve();
            };
            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        });
    }
};

main();
