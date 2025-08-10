const { joinVoiceChannel } = require('@discordjs/voice');

// O sistema exporta uma função que recebe o 'client' do Discord
module.exports = (client) => {
  // A ação é executada apenas uma vez, quando o bot estiver pronto
  client.once('ready', async () => {
    // ID da call para onde o bot deve se conectar
    const channelId = '1404229378505838735';
    
    // Busca a call com o ID especificado
    const channel = client.channels.cache.get(channelId);

    // Verifica se a call existe e se é um canal de voz (tipo 2)
    if (!channel || channel.type !== 2) {
      return;
    }

    try {
      // Tenta se conectar à call
      joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });
      // A requisição de 'não colocar log no console' foi atendida.
    } catch (error) {
      // Se houver erro na conexão, ele será ignorado do console, conforme solicitado
    }
  });
};