// FileName: index.js

const mqtt = require('mqtt');
const admin = require('firebase-admin');

// --- CONFIGURATION ---
const serviceAccount = require('./service-account-key.json');
const MQTT_BROKER_URL = 'mqtt://your.broker.address'; // e.g., 'mqtt://test.mosquitto.org'
const MQTT_TOPIC = 'device/data/topic'; // The topic your data is published on

// --- INITIALIZE FIREBASE ADMIN SDK ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log('Firebase Admin SDK initialized.');

// This is a placeholder. In a real app, you would get this token
// from a database where you stored it from the Android app.
// For testing, you can copy the token logged in your Android app's Logcat.
const TARGET_FCM_TOKEN = 'YOUR_ANDROID_DEVICE_FCM_TOKEN_HERE';

// --- CONNECT TO MQTT BROKER ---
const client = mqtt.connect(MQTT_BROKER_URL);

client.on('connect', () => {
    console.log('Connected to MQTT broker.');
    client.subscribe(MQTT_TOPIC, (err) => {
        if (!err) {
            console.log(`Successfully subscribed to topic: ${MQTT_TOPIC}`);
        } else {
            console.error('Subscription failed:', err);
        }
    });
});

// --- MAIN LOGIC: HANDLE INCOMING MQTT MESSAGES ---
client.on('message', (topic, message) => {
    try {
        const dataString = message.toString();
        // Assuming the data is JSON like: {"temp": 25.5, "humidity": 60, ...}
        const data = JSON.parse(dataString);
        console.log(`Received data from ${topic}:`, data);

        // *** YOUR CRITERIA LOGIC GOES HERE ***
        // Example: Send a notification if temperature is above 30
        if (data.temperature && data.temperature > 30) {
            console.log('CRITERIA MET: Temperature is high. Sending notification.');

            // Find the user's FCM token (here we use the hardcoded one)
            // In a real app: const token = await database.getTokenForUser(data.userId);
            const deviceToken = TARGET_FCM_TOKEN;
            
            sendFcmNotification(deviceToken, data.temperature);
        }

    } catch (error) {
        console.error('Error processing MQTT message:', error);
    }
});

client.on('error', (error) => {
    console.error('MQTT Client Error:', error);
});

// --- FUNCTION TO SEND NOTIFICATION VIA FCM ---
async function sendFcmNotification(token, temperature) {
    // This is a "data" message. It will always trigger onMessageReceived() in your app.
    const message = {
        data: {
            title: 'High Temperature Alert!',
            body: `The temperature has reached ${temperature}°C.`,
            sensorId: 'sensor_123' // You can send any custom data you want
        },
        token: token
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Successfully sent message:', response);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}
