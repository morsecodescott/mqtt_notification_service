const mongoose = require('mongoose');

const topicSettingsSchema = new mongoose.Schema({
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  enabled: { type: Boolean, default: false },
  alertSent: { type: Boolean, default: false },
}, { _id: false });

const deviceSchema = new mongoose.Schema({
  fcmToken: {
    type: String,
    required: true,
    unique: true,
  },
  topics: {
    type: Map,
    of: topicSettingsSchema,
    default: {},
  },
  generatorStatusAlerts: {
    enabled: { type: Boolean, default: false },
    lastStatus: { type: String, default: null },
  },
  communicationTimeout: {
    enabled: { type: Boolean, default: false },
    minutes: { type: Number, default: 60 },
    alertSent: { type: Boolean, default: false },
  },
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
