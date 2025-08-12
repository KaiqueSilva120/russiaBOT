const mongoose = require('mongoose');

const bauSchema = new mongoose.Schema({
    itemName: { type: String, required: true, unique: true },
    added: { type: Number, default: 0 },
    removed: { type: Number, default: 0 }
});

module.exports = mongoose.model('Bau', bauSchema);