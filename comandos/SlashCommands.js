const { REST, Routes } = require('discord.js');
const { CLIENT_ID, DISCORD_TOKEN } = process.env;

module.exports = (client) => {
  client.once('ready', async () => {
    try {
      const commands = client.commands.map(command => command.data.toJSON());
      
      console.log('[COMANDOS] Limpando comandos antigos....');

      const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
      const data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands },
      );

      const commandNames = data.map(cmd => `/${cmd.name}`).join(', ');
      console.log(`[COMANDOS] Comandos novos registrados.... [ ${commandNames} ]`);
      
    } catch (error) {
      console.error(error);
    }
  });
};