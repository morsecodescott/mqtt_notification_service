// FileName: fcmService.js

const admin = require('firebase-admin');

// Path to your Firebase service account key file.
const SERVICE_ACCOUNT_PATH = './service-account-key.json';

/**
 * Initializes the Firebase Admin SDK.
 * This must be called before any other Firebase operations can be performed.
 */
function initializeFirebase() {
    try {
        const serviceAccount = require(SERVICE_ACCOUNT_PATH);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        // Terminate the service if Firebase connection is not successful.
        process.exit(1);
    }
}

/**
 * Sends a notification to a specific device using its FCM token.
 * @param {string} token - The FCM registration token of the target device.
 * @param {object} notification - An object containing the title and body of the notification.
 * @returns {Promise<void>}
 */
async function sendNotification(token, { title, body }) {
    if (!token) {
        console.error('FCM token is missing. Cannot send notification.');
        return;
    }

    const message = {
        notification: { title, body },
        token: token
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent notification:', response);
    } catch (error) {
        console.error('Error sending FCM notification:', error);
    }
}

module.exports = {
    initializeFirebase,
    sendNotification
};
