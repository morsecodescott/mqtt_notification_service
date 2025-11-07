// FileName: config.js

// Aligns topic names with their descriptive counterparts for use in notifications.
const TOPIC_DEFINITIONS = {
    DC_INPUT_POWER: 'bluetti/AC200L2446000235977/state/dc_input_power',
    AC_INPUT_POWER: 'bluetti/AC200L2446000235977/state/ac_input_power',
    AC_OUTPUT_POWER: 'bluetti/AC200L2446000235977/state/ac_output_power',
    DC_OUTPUT_POWER: 'bluetti/AC200L2446000235977/state/dc_output_power',
    TOTAL_BATTERY_PERCENT: 'bluetti/AC200L2446000235977/state/total_battery_percent'
};

// Defines the monitoring configurations for each topic, including value thresholds and notification details.
const TOPIC_CONFIGS = {
    [TOPIC_DEFINITIONS.DC_INPUT_POWER]: {
        label: 'DC Input Power',
        unit: 'W',
        min: 30,
        max: 1000,
        // Generates notification content for values falling outside the defined range.
        getNotification: (value, status) => ({
            title: `DC Input Power Alert`,
            body: `Power is ${value}W, which is ${status} the normal range.`
        })
    },
    [TOPIC_DEFINITIONS.AC_INPUT_POWER]: {
        label: 'AC Input Power',
        unit: 'W',
        min: 100,
        max: 1500,
        getNotification: (value, status) => ({
            title: `AC Input Power Alert`,
            body: `Power is ${value}W, which is ${status} the normal range.`
        })
    },
    [TOPIC_DEFINITIONS.AC_OUTPUT_POWER]: {
        label: 'AC Output Power',
        unit: 'W',
        min: 20,
        max: 100,
        getNotification: (value, status) => ({
            title: `AC Output Power Alert`,
            body: `Power is ${value}W, which is ${status} the normal range.`
        })
    },
    [TOPIC_DEFINITIONS.DC_OUTPUT_POWER]: {
        label: 'DC Output Power',
        unit: 'W',
        min: 0,
        max: 100,
        getNotification: (value, status) => ({
            title: `DC Output Power Alert`,
            body: `Power is ${value}W, which is ${status} the normal range.`
        })
    },
    [TOPIC_DEFINITIONS.TOTAL_BATTERY_PERCENT]: {
        label: 'Total Battery Percent',
        unit: '%',
        min: 20,
        max: 100,
        getNotification: (value, status) => ({
            title: `Battery Alert`,
            body: `Battery is at ${value}%, which is ${status} the normal charge.`
        })
    }
};

// Provides a complete list of all topics that the service should subscribe to.
const ALL_TOPICS = [
    ...Object.values(TOPIC_DEFINITIONS),
    'bluetti/generator/status',
    'bluetti/AC200L2446000235977/state/#'
];

module.exports = {
    TOPIC_CONFIGS,
    ALL_TOPICS
};
