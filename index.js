const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, ActivityType, InteractionResponseFlags } = require('discord.js');
require('dotenv').config();
const mongoose = require('mongoose');

// ------------------- EXPRESS (KEEP ALIVE) -------------------
const express = require('express');
const server = express();

server.all('/', (req, res) => {
  res.send('Seu bot está online!');
});

function keepAlive() {
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log('Servidor ativo na porta', PORT);
  });
}

keepAlive();

// ------------------- CLIENT DISCORD -------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// ------------------- LOGS DE ERRO -------------------
client.on('error', error => console.error('[DISCORD ERROR]', error));
client.on('warn', info => console.warn('[DISCORD WARN]', info));
client.on('shardError', error => console.error('[DISCORD SHARD ERROR]', error));
client.on('invalidated', () => console.error('[DISCORD] Sessão invalidada!'));

// ------------------- MONGODB -------------------
async function connectToDatabase() {
  if (!process.env.MONGO_URI) return console.log('[DATABASE] MONGO_URI não definido!');
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[DATABASE] Conectado ao MongoDB com sucesso!');
  } catch (error) {
    console.error('[DATABASE] Erro ao conectar no MongoDB:', error);
  }
}

connectToDatabase();

// ------------------- CARREGAR COMANDOS -------------------
const slashCommandsPath = path.join(__dirname, 'comandos', 'SlashCommands.js');
const slashCommandsSystem = require(slashCommandsPath);
if (typeof slashCommandsSystem === 'function') {
  try {
    slashCommandsSystem(client);
    console.log('[SISTEMAS] Sistema carregado: SlashCommands.js');
  } catch (error) {
    console.error('Erro ao carregar o sistema SlashCommands.js:', error);
  }
}

// ------------------- CARREGAR OUTROS SISTEMAS -------------------
const systemsPath = path.join(__dirname, 'sistemas');
const systemFiles = fs.readdirSync(systemsPath).filter(file => file.endsWith('.js'));

for (const file of systemFiles) {
  const filePath = path.join(systemsPath, file);
  const system = require(filePath);

  if (typeof system === 'function') {
    try {
      system(client);
      console.log(`[SISTEMAS] Sistema carregado: ${file}`);
    } catch (error) {
      console.error(`Erro ao carregar o sistema ${file}:`, error);
    }
  }
}

// ------------------- INTERAÇÕES -------------------
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: 'Comando não encontrado!', flags: InteractionResponseFlags.Ephemeral });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({ content: 'Ocorreu um erro ao executar este comando!', flags: InteractionResponseFlags.Ephemeral });
  }
});

// ------------------- READY E STATUS -------------------
client.once('ready', () => {
  console.log(`Pronto! Logado como ${client.user.tag}`);
  console.log('[DISCORD] Cliente pronto e conectado!');

  client.user.setPresence({
    status: 'dnd',
    activities: [{ name: '💙 Nova Capital', type: ActivityType.Playing }]
  });
});

// ------------------- LOGIN COM DETECÇÃO DE ERROS -------------------
if (!process.env.DISCORD_TOKEN) {
  console.error('[LOGIN] DISCORD_TOKEN não definido!');
} else {
  console.log('[LOGIN] Tentando conectar ao Discord...');
  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('[LOGIN ERROR]', err);
  });
}
