// FileName: stateManager.js

// An in-memory store to track the alert status of each monitored topic.
const alertStates = new Map();

/**
 * Initializes the alert state for a given topic.
 * By default, a topic is considered to be in a 'normal' state.
 * @param {string} topic - The MQTT topic to initialize.
 */
function initializeState(topic) {
    if (!alertStates.has(topic)) {
        alertStates.set(topic, { inAlert: false });
    }
}

/**
 * Updates the alert state of a topic.
 * @param {string} topic - The MQTT topic to update.
 * @param {boolean} inAlert - The new alert status.
 */
function updateState(topic, inAlert) {
    alertStates.set(topic, { inAlert });
}

/**
 * Retrieves the current alert state for a given topic.
 * @param {string} topic - The MQTT topic to check.
 * @returns {boolean} - True if the topic is currently in an alert state, otherwise false.
 */
function isAlert(topic) {
    return alertStates.get(topic)?.inAlert || false;
}

/**
 * Determines if a notification should be sent for a topic based on its current and new alert status.
 * A notification is only warranted if the state is changing from 'normal' to 'alert'.
 * @param {string} topic - The MQTT topic.
 * @param {boolean} isOutOfRange - Whether the latest value for the topic is outside the defined limits.
 * @returns {boolean} - True if a notification should be sent, otherwise false.
 */
function shouldNotify(topic, isOutOfRange) {
    const currentState = isAlert(topic);
    // Notify only if the value is out of range AND the topic was not previously in an alert state.
    return isOutOfRange && !currentState;
}

module.exports = {
    initializeState,
    updateState,
    isAlert,
    shouldNotify
};
