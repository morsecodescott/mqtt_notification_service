// FileName: index.js
require('dotenv').config();
const express = require('express');
const mqtt = require('mqtt');
const connectDB = require('./db');
const Device = require('./models/device');
const { TOPIC_CONFIGS, ALL_TOPICS } = require('./config'); // Keep for labels and notification formats
const { initializeFirebase, sendNotification } = require('./fcmService');

// --- SERVICE INITIALIZATION ---
const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

connectDB();
initializeFirebase();

// --- API ENDPOINT ---
app.post('/device', async (req, res) => {
  const { fcmToken, topics, generatorStatusAlerts, communicationTimeout } = req.body;

  if (!fcmToken) {
    return res.status(400).send({ error: 'fcmToken is required' });
  }

  try {
    const update = {};
    if (topics !== undefined) update.topics = topics;
    if (generatorStatusAlerts !== undefined) update.generatorStatusAlerts = generatorStatusAlerts;
    if (communicationTimeout !== undefined) {
      update.communicationTimeout = communicationTimeout;
      // Reset alertSent flag when disabling timeout alerts
      if (communicationTimeout.enabled === false) {
        update.communicationTimeout.alertSent = false;
      }
    }

    const device = await Device.findOneAndUpdate(
      { fcmToken },
      { $set: update, $setOnInsert: { fcmToken: fcmToken } }, // Use $set for partial updates
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).send(device);
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).send({ error: 'Failed to update device' });
  }
});

// --- MQTT CLIENT SETUP ---
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

const mqttOptions = {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    protocol: 'mqtts',
    connectTimeout: 5000
};

// --- WATCHDOG AND CORE LOGIC ---
let lastStateUpdateTimestamp = Date.now();
const WATCHDOG_TOPIC_PREFIX = 'bluetti/AC200L2446000235977/state/';

const client = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

// --- WATCHDOG CHECKER ---
setInterval(async () => {
    try {
        const devices = await Device.find({ 'communicationTimeout.enabled': true, 'communicationTimeout.alertSent': false });
        for (const device of devices) {
            const timeoutMillis = device.communicationTimeout.minutes * 60 * 1000;
            if (Date.now() - lastStateUpdateTimestamp > timeoutMillis) {
                const notification = {
                    title: 'System Communication Timeout',
                    body: `The system has not reported in for over ${device.communicationTimeout.minutes} minutes.`,
                };
                sendNotification(device.fcmToken, notification);
                device.communicationTimeout.alertSent = true;
                await device.save();
            }
        }
    } catch (error) {
        console.error('Error in communication timeout checker:', error);
    }
}, 60 * 1000); // Run every minute


async function resetTimeoutAlerts() {
    try {
        await Device.updateMany(
            { 'communicationTimeout.alertSent': true },
            { $set: { 'communicationTimeout.alertSent': false } }
        );
    } catch (error) {
        console.error('Error resetting timeout alerts:', error);
    }
}

client.on('connect', () => {
    console.log('Successfully connected to MQTT broker.');
    client.subscribe(ALL_TOPICS, (err) => {
        if (err) {
            console.error('Subscription failed:', err);
        } else {
            console.log('Successfully subscribed to all topics.');
        }
    });
});

// --- DEDICATED HANDLERS ---
async function handleNumericThreshold(topic, message) {
    const value = parseFloat(message.toString());
    if (isNaN(value)) {
        console.warn(`Could not parse numeric value from message on topic ${topic}`);
        return;
    }

    try {
        const devices = await Device.find({ [`topics.${topic}.enabled`]: true });
        for (const device of devices) {
            const topicSettings = device.topics.get(topic);
            let hasChanged = false;

            const isLow = topicSettings.min !== null && topicSettings.min !== 0 && value < topicSettings.min;
            const isHigh = topicSettings.max !== null && topicSettings.max !== 0 && value > topicSettings.max;

            // Check for low threshold violation
            if (isLow) {
                if (!topicSettings.alertSentLow) {
                    const staticConfig = TOPIC_CONFIGS[topic];
                    const notification = staticConfig.getNotification(value, 'below');
                    sendNotification(device.fcmToken, notification);
                    topicSettings.alertSentLow = true;
                    hasChanged = true;
                }
            }
            // Check for high threshold violation
            else if (isHigh) {
                if (!topicSettings.alertSentHigh) {
                    const staticConfig = TOPIC_CONFIGS[topic];
                    const notification = staticConfig.getNotification(value, 'above');
                    sendNotification(device.fcmToken, notification);
                    topicSettings.alertSentHigh = true;
                    hasChanged = true;
                }
            }
            // If the value is within the normal range, reset both alerts
            else {
                if (topicSettings.alertSentLow || topicSettings.alertSentHigh) {
                    topicSettings.alertSentLow = false;
                    topicSettings.alertSentHigh = false;
                    hasChanged = true;
                }
            }

            if (hasChanged) {
                device.topics.set(topic, topicSettings);
                await device.save();
            }
        }
    } catch (error) {
        console.error('Error processing numeric threshold message:', error);
    }
}

async function handleGeneratorStatusUpdate(topic, message) {
    const status = message.toString();
    if (status !== 'On' && status !== 'Off') {
        console.warn(`Invalid generator status received: ${status}`);
        return;
    }

    try {
        const devices = await Device.find({ 'generatorStatusAlerts.enabled': true });
        for (const device of devices) {
            const { lastStatus } = device.generatorStatusAlerts;

            if (lastStatus && lastStatus !== status) {
                const notification = {
                    title: 'Generator Status Change',
                    body: `Generator has been turned ${status}.`,
                };
                sendNotification(device.fcmToken, notification);
            }

            // Update lastStatus regardless of whether a notification was sent
            device.generatorStatusAlerts.lastStatus = status;
            await device.save();
        }
    } catch (error) {
        console.error('Error processing generator status update:', error);
    }
}

// --- MESSAGE ROUTER ---
client.on('message', async (topic, message) => {
    console.log(`Received message on ${topic}: ${message.toString()}`);

    // Update timestamp for watchdog if the topic matches the prefix
    if (topic.startsWith(WATCHDOG_TOPIC_PREFIX)) {
        lastStateUpdateTimestamp = Date.now();
        await resetTimeoutAlerts(); // A new message resets all timeout alerts
    }

    if (topic === 'bluetti/generator/status') {
        await handleGeneratorStatusUpdate(topic, message);
    } else if (TOPIC_CONFIGS[topic]) {
        await handleNumericThreshold(topic, message);
    }
    // No 'else' block needed; watchdog topics are handled by the timestamp update above
});

client.on('error', (error) => {
    console.error('MQTT Client Error:', error);
});

// --- SERVER AND PROCESS HANDLING ---
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

process.on('SIGINT', () => {
    console.log('Disconnecting from MQTT broker...');
    client.end(() => {
        console.log('MQTT client disconnected. Exiting.');
        process.exit(0);
    });
});
