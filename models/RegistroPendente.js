const { Schema, model } = require('mongoose');

const RegistroPendenteSchema = new Schema({
    userId: { type: String, required: true, unique: true },
    messageId: { type: String, required: true },
    nomeSobrenome: { type: String, required: true },
    rg: { type: String, required: true },
    telefone: { type: String, required: true },
    recrutador: { type: String, required: true },
    dataEnvio: { type: Date, default: Date.now },
});

module.exports = model('RegistroPendente', RegistroPendenteSchema);