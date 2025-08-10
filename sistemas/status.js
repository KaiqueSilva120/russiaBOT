const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  const command = {
    data: new SlashCommandBuilder()
      .setName('status')
      .setDescription('Mostra o status atual do bot.'),

    async execute(interaction) {
      const client = interaction.client;
      const uptimeInSeconds = Math.floor(client.uptime / 1000);
      const uptimeDays = Math.floor(uptimeInSeconds / 86400);
      const uptimeHours = Math.floor((uptimeInSeconds % 86400) / 3600);
      const uptimeMinutes = Math.floor((uptimeInSeconds % 3600) / 60);
      const uptimeSeconds = uptimeInSeconds % 60;
      const uptimeString = `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;

      const guildCount = client.guilds.cache.size;
      const ping = client.ws.ping;
      const commandCount = client.commands.size;

      const serverTime = new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour12: false,
      });

      const embed = new EmbedBuilder()
        .setTitle('<a:low_bot:1402749493551566899> Status do Bot')
        .setThumbnail(client.user.displayAvatarURL())
        .addFields(
          { name: '<a:info:1402749673076166810> Atividade', value: uptimeString, inline: true },
          { name: '🌐 Servidores', value: guildCount.toString(), inline: true },
          { name: '<:pureza_i:1391511885123420371> Ping', value: `${ping}ms`, inline: true },
          { name: '<:SlashCommands:1402754768702672946> Comandos Carregados', value: commandCount.toString(), inline: true },
          { name: '<:time:1402754149631660182> Horário do Servidor', value: serverTime, inline: true },
          { name: '<:v_staff:1391511999338250256> BOT', value: `<@${client.user.id}>`, inline: true },
          { name: '<:BVB_blue_dev:1391512395817422900> Criador', value: '<@707959058228969485>', inline: true }
        )
        .setColor('Blue')
        .setFooter({ text: '🤖 Bot Oficial da Rússia do Nova Capital' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  };

  client.commands.set(command.data.name, command);
};