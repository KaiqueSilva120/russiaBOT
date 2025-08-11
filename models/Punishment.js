// models/Punishment.js
const mongoose = require('mongoose');

const punishmentSchema = new mongoose.Schema({
  memberId: {
    type: String,
    required: true,
  },
  memberName: {
    type: String,
    required: true,
  },
  punishmentType: {
    type: String,
    required: true,
  },
  roleId: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  punisherId: {
    type: String,
    required: true,
  },
  punishedAt: {
    type: Number,
    required: true,
  },
  expiresAt: {
    type: Number,
    default: null,
  },
  logMessageId: {
    type: String,
    default: null,
  },
  guildId: {
    type: String,
    required: true,
  },
  logChannelId: {
    type: String,
    required: true,
  },
  highestRole: {
    type: String,
    default: 'Não especificado',
  },
});

module.exports = mongoose.model('Punishment', punishmentSchema);