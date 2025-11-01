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
  const { fcmToken, topics } = req.body;

  if (!fcmToken) {
    return res.status(400).send({ error: 'fcmToken is required' });
  }

  try {
    const device = await Device.findOneAndUpdate(
      { fcmToken },
      { fcmToken, topics },
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

// --- CORE APPLICATION LOGIC ---
const client = mqtt.connect(MQTT_BROKER_URL, mqttOptions);

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

client.on('message', async (topic, message) => {
    const messageStr = message.toString();
    console.log(`Received message on ${topic}: ${messageStr}`);

    const value = parseFloat(messageStr);
    if (isNaN(value)) {
        console.warn(`Could not parse numeric value from message on topic ${topic}`);
        return;
    }

    try {
        const devices = await Device.find();
        for (const device of devices) {
            const topicSettings = device.topics.get(topic);

            if (!topicSettings || !topicSettings.enabled) {
                continue;
            }

            let outOfRangeStatus = '';
            if (topicSettings.min !== null && value < topicSettings.min) {
                outOfRangeStatus = 'below';
            } else if (topicSettings.max !== null && value > topicSettings.max) {
                outOfRangeStatus = 'above';
            }

            const isOutOfRange = !!outOfRangeStatus;
            const hasAlertBeenSent = topicSettings.alertSent;

            if (isOutOfRange && !hasAlertBeenSent) {
                const staticConfig = TOPIC_CONFIGS[topic];
                console.log(`Alert condition met for ${staticConfig.label} on device ${device.fcmToken}. Sending notification.`);
                const notification = staticConfig.getNotification(value, outOfRangeStatus);
                sendNotification(device.fcmToken, notification);

                // Update state in DB
                device.topics.get(topic).alertSent = true;
                await device.save();

            } else if (!isOutOfRange && hasAlertBeenSent) {
                // Value is back in range, reset the alert state
                device.topics.get(topic).alertSent = false;
                await device.save();
            }
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
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
