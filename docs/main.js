/**
 *
 */
const main = async () => {
    await startServiceWorker();

    // Method 4:
    if (location.search) {
        await load(location.search.substring(1));
        return;
    }

    // Method 1:
    window.addEventListener('dragover', (event) => event.preventDefault());
    window.addEventListener('drop', onWindowDrop);

    // Method 2:
    window.addEventListener('paste', onWindowPaste);

    // Method 3:
    const inputElement = document.getElementById('input');
    inputElement.addEventListener('change', onInputChange);
    inputElement.addEventListener('cancel', () => 0);

    // Method 5:
    window.addEventListener('message', onWindowMessage);
};

/**
 *
 */
const onWindowDrop = (event) => {
    event.preventDefault();
    const {dataTransfer} = event;
    const text = dataTransfer.getData('text/plain');
    if (text) {
        load(text);
    } else {
        const [file] = dataTransfer.files;
        load(file);
    }
};

/**
 *
 */
const onWindowPaste = (event) => {
    const {clipboardData} = event;
    const text = clipboardData.getData('text/plain');
    if (text) {
        load(text);
    } else {
        const [file] = clipboardData.files;
        load(file);
    }
};

/**
 *
 */
const onWindowMessage = (event) => {
    const {data = {}} = event;
    if (data.payload) {
        load(data.payload);
    }
};

/**
 *
 */
const onInputChange = (event) => {
    load(event.currentTarget.files[0]);
};

/**
 *
 */
const load = async (blob) => {
    if (typeof blob === 'string') {
        const response = await fetch(blob);
        blob = await response.blob();
    }

    navigator.serviceWorker.addEventListener('message', onMessageFromSW);
    navigator.serviceWorker.controller.postMessage({
        type: 'RECEIVE_BLOB',
        blob,
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
