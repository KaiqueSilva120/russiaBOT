const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://kaiquerlq:Kaique2008@cluster9876543.g0v89vb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster9876543';

async function connectToDatabase() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('[DATABASE] Conectado ao MongoDB com sucesso!');
        return true;
    } catch (error) {
        console.error('[DATABASE] Erro ao conectar ao MongoDB:', error);
        return false;
    }
}

module.exports = connectToDatabase;