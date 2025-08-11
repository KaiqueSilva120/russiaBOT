const mongoose = require('mongoose');

const ausenciaSchema = new mongoose.Schema({
    memberId: { type: String, required: true, unique: true },
    memberName: { type: String, required: true },
    motivo: { type: String },
    dataSaida: { type: String, required: true },
    dataRetorno: { type: String, required: true },
    moderadorId: { type: String, required: true },
    guildId: { type: String, required: true },
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    rg: { type: String, required: true },
    retornoTimestamp: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Ausencia = mongoose.model('Ausencia', ausenciaSchema);

module.exports = Ausencia;