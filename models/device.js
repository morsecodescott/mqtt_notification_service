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
});

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
