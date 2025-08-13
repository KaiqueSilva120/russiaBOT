const { Schema, model } = require('mongoose');

const MembroSchema = new Schema({
    userId: { type: String, required: true },
    nomeSobrenome: { type: String, required: true },
    rg: { type: String, required: true },
    telefone: { type: String, required: true },
    recrutador: { type: String, required: true },
    cargoId: { type: String, required: true },
    messageId: { type: String, required: true }, // Campo adicionado
    dataRegistro: { type: Date, default: Date.now },
});

module.exports = model('Membro', MembroSchema);