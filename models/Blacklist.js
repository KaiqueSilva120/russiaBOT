const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    memberId: { type: String, required: true, unique: true },
    memberName: { type: String, required: true },
    reason: { type: String, required: false },
    moderadorId: { type: String, required: true },
    dataEntrada: { type: Date, default: Date.now }
});

const Blacklist = mongoose.model('Blacklist', blacklistSchema);

module.exports = Blacklist;