const mongoose = require('mongoose');

const movimentacaoSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    rg: { type: String, required: true },
    item: { type: String, required: true },
    quantity: { type: Number, required: true },
    actionType: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Movimentacao', movimentacaoSchema);