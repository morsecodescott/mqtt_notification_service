// FileName: index.js
// Load environment variables from a .env file into process.env
require('dotenv').config();

const mqtt = require('mqtt');
const { TOPIC_CONFIGS, ALL_TOPICS } = require('./config');
const { initializeState, shouldNotify, updateState } = require('./stateManager');
const { initializeFirebase, sendNotification } = require('./fcmService');

// --- SERVICE INITIALIZATION ---

// Initialize the Firebase Admin SDK to enable notifications.
initializeFirebase();

// Initialize the state for each topic to prevent duplicate alerts.
ALL_TOPICS.forEach(initializeState);

// --- MQTT CLIENT SETUP ---

// Retrieve MQTT connection details from environment variables.
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const FCM_TOKEN = process.env.FCM_TOKEN;

// Configure MQTT client options for a secure connection.
const mqttOptions = {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    protocol: 'mqtts', // Ensure a secure connection
    connectTimeout: 5000 // 5 seconds
};

// --- CORE APPLICATION LOGIC ---

// Establish connection to the MQTT broker.
const client = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

// Fired when the client successfully connects to the broker.
client.on('connect', () => {
    console.log('Successfully connected to MQTT broker.');
    // Subscribe to all configured topics.
    client.subscribe(ALL_TOPICS, (err) => {
        if (err) {
            console.error('Subscription failed:', err);
            // Consider adding reconnection logic or exiting.
        } else {
            console.log('Successfully subscribed to all topics.');
        }
    });
});

// Fired when a message is received on any of the subscribed topics.
client.on('message', (topic, message) => {
    const messageStr = message.toString();
    console.log(`Received message on ${topic}: ${messageStr}`);

    const config = TOPIC_CONFIGS[topic];
    if (!config) {
        // Ignore messages from topics that are not configured.
        return;
    }

    // Attempt to parse the message as a numeric value.
    const value = parseFloat(messageStr);
    if (isNaN(value)) {
        console.warn(`Could not parse numeric value from message on topic ${topic}`);
        return;
    }

    // Determine if the value is outside the acceptable range.
    let outOfRangeStatus = '';
    if (value < config.min) {
        outOfRangeStatus = 'below';
    } else if (value > config.max) {
        outOfRangeStatus = 'above';
    }

    const isOutOfRange = !!outOfRangeStatus;

    // Use the state manager to decide if a notification is warranted.
    if (shouldNotify(topic, isOutOfRange)) {
        console.log(`Alert condition met for ${config.label}. Sending notification.`);

        // Generate and send the notification.
        const notification = config.getNotification(value, outOfRangeStatus);
        sendNotification(FCM_TOKEN, notification);

        // Update the state to reflect that an alert has been issued.
        updateState(topic, true);
    } else if (!isOutOfRange) {
        // If the value is back within the normal range, reset the alert state.
        updateState(topic, false);
    }
});

// Fired on MQTT client errors.
client.on('error', (error) => {
    console.error('MQTT Client Error:', error);
});

// Gracefully handle process termination.
process.on('SIGINT', () => {
    console.log('Disconnecting from MQTT broker...');
    client.end(() => {
        console.log('MQTT client disconnected. Exiting.');
        process.exit(0);
    });
});
