const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    type: { type: String, required: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    transcript: [{
        author: String,
        content: String,
        timestamp: Date
    }]
});

module.exports = mongoose.model('Ticket', ticketSchema);