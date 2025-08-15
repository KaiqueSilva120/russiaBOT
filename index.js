const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, ActivityType, InteractionResponseFlags } = require('discord.js');
require('dotenv').config();

// Adiciona o módulo express para criar um servidor web
const express = require('express');
const server = express();
server.all('/', (req, res) => {
  res.send('Seu bot está online!');
});
function keepAlive() {
  server.listen(3000, () => {
    console.log('Servidor ativo!');
  });
}
keepAlive();


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
let registerCommands;

// Carrega o sistema de gerenciamento de comandos da pasta 'comandos'
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

// Carrega todos os outros sistemas da pasta 'sistemas'
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

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    // Linha corrigida para usar flags: 64 em vez de flags: InteractionResponseFlags.Ephemeral
    return interaction.reply({ content: 'Comando não encontrado!', flags: InteractionResponseFlags.Ephemeral });
  }
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    // Linha corrigida para usar flags: 64 em vez de flags: InteractionResponseFlags.Ephemeral
    await interaction.reply({ content: 'Ocorreu um erro ao executar este comando!', flags: InteractionResponseFlags.Ephemeral });
  }
});

client.once('ready', () => {
  console.log(`Pronto! Logado como ${client.user.tag}`);

  // Define o status do bot como 'Não Perturbe' e a atividade como 'Jogando 💙 Nova Capital'
  client.user.setPresence({
    status: 'dnd', // dnd = Do Not Disturb (Não Perturbe)
    activities: [{
      name: '💙 Nova Capital',
      type: ActivityType.Playing // 'Playing' (Jogando)
    }]
  });
});

client.login(process.env.DISCORD_TOKEN);