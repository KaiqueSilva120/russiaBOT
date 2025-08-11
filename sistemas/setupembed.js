const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../dados/embedDB/embedMessages.json');

// --- Funções de Manipulação de Dados ---
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify({}));
      return new Map();
    }
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return new Map(Object.entries(JSON.parse(data)));
  } catch (e) {
    console.error('Erro ao carregar dados:', e);
    return new Map();
  }
}

function saveData(map) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(map), null, 2));
  } catch (e) {
    console.error('Erro ao salvar dados:', e);
  }
}

// --- Funções de Validação ---
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidHexColor(color) {
  return /^#([0-9A-F]{6})$/i.test(color);
}

// --- Funções de Criação de Componentes UI ---
function createMainMenuButtons() {
    const createButton = new ButtonBuilder()
        .setCustomId('setupembed_create')
        .setLabel('Criar Embed')
        .setStyle(ButtonStyle.Primary);

    const deleteButton = new ButtonBuilder()
        .setCustomId('setupembed_delete')
        .setLabel('Excluir Embed')
        .setStyle(ButtonStyle.Danger);

    const editButton = new ButtonBuilder()
        .setCustomId('setupembed_edit')
        .setLabel('Editar Embed')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder()
        .addComponents(createButton, deleteButton, editButton);

    return row;
}

// O módulo exporta uma função que é executada pelo index.js
module.exports = (client) => {
  // Inicializa as coleções e dados
  client.embedMessages = loadData();
  client.tempEmbedData = new Map();

  // Define os comandos de barra dentro desta função
  const slashCommands = [
    {
      data: new SlashCommandBuilder()
        .setName('setupembed')
        .setDescription('Criar, excluir ou editar suas embeds personalizadas.'),
      async execute(interaction) {
        const buttonsRow = createMainMenuButtons();
        await interaction.reply({
            content: '<:pureza_i:1391511885123420371> Gerenciamento de Embeds',
            components: [buttonsRow],
            flags: InteractionResponseFlags.Ephemeral,
        });
      },
    },
    {
      data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Faz o bot enviar uma mensagem em seu nome.')
        .addStringOption(option =>
            option.setName('mensagem')
                .setDescription('O conteúdo da mensagem para enviar.')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('anexo')
                .setDescription('Um arquivo para anexar à mensagem (opcional).')
                .setRequired(false)),
      async execute(interaction) {
        const messageContent = interaction.options.getString('mensagem');
        const attachment = interaction.options.getAttachment('anexo');

        const payload = {
            content: messageContent,
        };

        if (attachment) {
            payload.files = [{ attachment: attachment.url }];
        }

        try {
            await interaction.channel.send(payload);
            await interaction.reply({
                content: '<:Positivo:1403203942573150362> Mensagem enviada com sucesso!',
                flags: InteractionResponseFlags.Ephemeral,
            });
        } catch (error) {
            console.error('Erro ao enviar mensagem com o comando /say:', error);
            await interaction.reply({
                content: '<:Negativo:1403204560058585138> Houve um erro ao tentar enviar a mensagem. Chama o exorcista q é demonio.',
                flags: InteractionResponseFlags.Ephemeral,
            });
        }
      },
    },
  ];

  // Adiciona os comandos à coleção 'client.commands' para serem registrados e executados.
  for (const command of slashCommands) {
    client.commands.set(command.data.name, command);
  }

  // Define os listeners de eventos, como botões e modais.
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
      await handleButtonInteraction(interaction, client);
    }
    if (interaction.isStringSelectMenu()) {
      await handleSelectMenu(interaction, client);
    }
    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction, client);
    }
  });

  // --- Funções de manuseio de interações (botões, modais, etc.) ---
  async function handleButtonInteraction(interaction, client) {
    const customId = interaction.customId;

    if (customId === 'setupembed_create') {
      const modal = new ModalBuilder()
        .setCustomId('setupembed_createEmbedModal')
        .setTitle('Criar Embed');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedTitle')
            .setLabel('Título da Embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedDesc')
              .setLabel('Descrição da Embed')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedColor')
              .setLabel('Cor da Embed (Hex, ex: #3498DB)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedImage')
              .setLabel('URL da Imagem (opcional)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('embedFooterText')
              .setLabel('Texto do Rodapé (opcional)')
              .setStyle(TextInputStyle.Short)
              .setRequired(false)
          )
        );
        await interaction.showModal(modal);
        return;
      }

      if (customId === 'setupembed_delete') {
        const userId = interaction.user.id;
        const embeds = client.embedMessages.get(userId) || [];

        if (embeds.length === 0) {
          await interaction.update({
            content: '<:Negativo:1403204560058585138> Você não tem embeds enviadas para excluir.',
            components: [],
            flags: InteractionResponseFlags.Ephemeral,
          });
          return;
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('setupembed_deleteEmbedSelect')
          .setPlaceholder('Selecione a embed para apagar')
          .addOptions(
            embeds.map((e, i) => ({
              label: e.embedData.title.slice(0, 100),
              description: e.embedData.description.slice(0, 100),
              value: String(i),
            }))
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({
          content: '⚠️ Qual embed deseja apagar?',
          components: [row],
          flags: InteractionResponseFlags.Ephemeral,
        });
        return;
      }

      if (customId === 'setupembed_edit') {
        const userId = interaction.user.id;
        const embeds = client.embedMessages.get(userId) || [];

        if (embeds.length === 0) {
          await interaction.update({
            content: '❌ Você não tem embeds para editar.',
            components: [],
            flags: InteractionResponseFlags.Ephemeral,
          });
          return;
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('setupembed_editEmbedSelect')
          .setPlaceholder('Selecione a embed para editar')
          .addOptions(
            embeds.map((e, i) => ({
              label: e.embedData.title.slice(0, 100),
              description: e.embedData.description.slice(0, 100),
              value: String(i),
            }))
          );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        await interaction.update({
          content: '⚠️ Qual embed deseja editar?',
          components: [row],
          flags: InteractionResponseFlags.Ephemeral,
        });
        return;
      }
  }

  async function handleSelectMenu(interaction, client) {
    if (interaction.customId === 'setupembed_deleteEmbedSelect') {
      const userId = interaction.user.id;
      const index = parseInt(interaction.values[0], 10);
      const embeds = client.embedMessages.get(userId) || [];

      if (index < 0 || index >= embeds.length) {
        await interaction.reply({ content: '<:Negativo:1403204560058585138> Seleção inválida.', flags: InteractionResponseFlags.Ephemeral });
        return;
      }

      const toDelete = embeds[index];

      try {
        const channel = await client.channels.fetch(toDelete.channelId);
        if (channel && channel.isTextBased()) {
          const msg = await channel.messages.fetch(toDelete.messageId);
          if (msg) {
            await msg.delete();
          }
        } else {
            console.warn(`Canal ${toDelete.channelId} não encontrado ou não é de texto para deletar a embed.`);
        }
      } catch (e) {
        console.warn('Erro ao tentar deletar mensagem no Discord (pode já ter sido excluída):', e.message);
      }

      embeds.splice(index, 1);
      client.embedMessages.set(userId, embeds);
      saveData(client.embedMessages);

      await interaction.update({ content: '<:Positivo:1403203942573150362> Embed apagada com sucesso!', components: [], flags: InteractionResponseFlags.Ephemeral });
      return;
    }

    if (interaction.customId === 'setupembed_editEmbedSelect') {
      const userId = interaction.user.id;
      const index = parseInt(interaction.values[0], 10);
      const embeds = client.embedMessages.get(userId) || [];

      if (index < 0 || index >= embeds.length) {
        await interaction.reply({ content: '<:Negativo:1403204560058585138> Seleção inválida.', flags: InteractionResponseFlags.Ephemeral });
        return;
      }

      const toEdit = embeds[index];
      const data = toEdit.embedData;

      const modal = new ModalBuilder()
        .setCustomId(`setupembed_editEmbedModal_${index}`)
        .setTitle('Editar Embed');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedTitle')
            .setLabel('Título da Embed')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(data.title || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedDesc')
            .setLabel('Descrição da Embed')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue(data.description || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedColor')
            .setLabel('Cor da Embed (Hex, ex: #3498DB)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(data.color || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedImage')
            .setLabel('URL da Imagem (opcional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(data.image || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embedFooterText')
            .setLabel('Texto do Rodapé (opcional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(data.footerText || '')
        )
      );

      await interaction.showModal(modal);
      return;
    }
  }

  async function handleModalSubmit(interaction, client) {
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const isEditModal = interaction.customId.startsWith('setupembed_editEmbedModal_');
    const isCreateModal = interaction.customId === 'setupembed_createEmbedModal';

    if (isCreateModal) {
      await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });

      const title = interaction.fields.getTextInputValue('embedTitle');
      const description = interaction.fields.getTextInputValue('embedDesc');
      let color = interaction.fields.getTextInputValue('embedColor') || '#3498DB';
      const image = interaction.fields.getTextInputValue('embedImage');
      const footerText = interaction.fields.getTextInputValue('embedFooterText');

      if (!isValidHexColor(color)) {
        color = '#3498DB';
      }

      client.tempEmbedData.set(userId, {
        title,
        description,
        color,
        image: isValidUrl(image) ? image : null,
        footerText,
        guildId: guild?.id,
      });

      await interaction.editReply({
        content: '<:Positivo:1403203942573150362> Embed criada! Agora, por favor, **mencione o canal** para onde deseja enviar essa embed.',
      });

      const filter = m => m.author.id === userId && m.mentions.channels.size > 0;
      const collector = interaction.channel.createMessageCollector({ filter, time: 60000, max: 1 });

      collector.on('collect', async m => {
        const channel = m.mentions.channels.first();
        const embedData = client.tempEmbedData.get(userId);
        
        await m.delete();

        if (!channel || !channel.isTextBased() || !embedData) {
          await interaction.followUp({ content: '<:Negativo:1403204560058585138> Canal inválido, ou dados da embed não encontrados. Tente novamente.', flags: InteractionResponseFlags.Ephemeral });
          client.tempEmbedData.delete(userId);
          return;
        }

        const embedToSend = new EmbedBuilder()
          .setTitle(embedData.title)
          .setDescription(embedData.description)
          .setColor(embedData.color);

        if (embedData.image) {
          embedToSend.setImage(embedData.image);
        }
        if (embedData.footerText) {
          embedToSend.setFooter({ text: embedData.footerText });
        }

        try {
          const sentMessage = await channel.send({ embeds: [embedToSend] });

          const userEmbeds = client.embedMessages.get(userId) || [];
          userEmbeds.push({
            embedData: embedData,
            channelId: channel.id,
            messageId: sentMessage.id
          });
          client.embedMessages.set(userId, userEmbeds);
          saveData(client.embedMessages);

          // <<< A MUDANÇA ESTÁ AQUI >>>
          // Envia uma mensagem pública no canal para confirmar a ação para todos.
          await channel.send(`<:Positivo:1403203942573150362> A embed foi criada por ${interaction.user.tag} e enviada com sucesso para este canal!`);
          
          // E uma mensagem efêmera para o usuário.
          await interaction.followUp({ content: '<:Positivo:1403203942573150362> Embed enviada com sucesso! A confirmação pública já foi enviada no canal.', flags: InteractionResponseFlags.Ephemeral });

        } catch (error) {
          console.error('Erro ao enviar a embed para o canal ou salvar:', error);
          await interaction.followUp({ content: '<:Negativo:1403204560058585138> Houve um erro ao tentar enviar a embed para o canal. Verifique as permissões do bot.', flags: InteractionResponseFlags.Ephemeral });
        } finally {
          client.tempEmbedData.delete(userId);
          collector.stop();
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0 && client.tempEmbedData.has(userId)) {
          interaction.followUp({ content: '<a:relogio:1403118839557918770> Tempo esgotado! Você não mencionou um canal. A criação da embed foi cancelada.', flags: InteractionResponseFlags.Ephemeral });
          client.tempEmbedData.delete(userId);
        }
      });

      return;
    }

    if (isEditModal) {
      const indexStr = interaction.customId.replace('setupembed_editEmbedModal_', '');
      const index = parseInt(indexStr, 10);
      
      const embeds = client.embedMessages.get(userId) || [];
      if (index < 0 || index >= embeds.length) {
        await interaction.reply({ content: '❌ Índice inválido para edição.', flags: InteractionResponseFlags.Ephemeral });
        return;
      }

      const title = interaction.fields.getTextInputValue('embedTitle');
      const description = interaction.fields.getTextInputValue('embedDesc');
      let color = interaction.fields.getTextInputValue('embedColor') || '#3498DB';
      const image = interaction.fields.getTextInputValue('embedImage');
      const footerText = interaction.fields.getTextInputValue('embedFooterText');

      if (!isValidHexColor(color)) {
        color = '#3498DB';
      }

      const updatedEmbedData = {
        title,
        description,
        color,
        image: isValidUrl(image) ? image : null,
        footerText,
      };

      embeds[index].embedData = updatedEmbedData;
      client.embedMessages.set(userId, embeds);
      saveData(client.embedMessages);

      const originalEmbedInfo = embeds[index];
      try {
        const channel = await client.channels.fetch(originalEmbedInfo.channelId);
        if (channel && channel.isTextBased()) {
          const msg = await channel.messages.fetch(originalEmbedInfo.messageId);
          if (msg) {
                const embedToEdit = new EmbedBuilder()
                    .setTitle(updatedEmbedData.title)
                    .setDescription(updatedEmbedData.description)
                    .setColor(updatedEmbedData.color);
                if (updatedEmbedData.image) embedToEdit.setImage(updatedEmbedData.image);
                if (updatedEmbedData.footerText) embedToEdit.setFooter({ text: updatedEmbedData.footerText });
            await msg.edit({ embeds: [embedToEdit] });
          }
        }
      } catch (e) {
        console.warn('Erro ao tentar editar mensagem no Discord (pode já ter sido excluída):', e.message);
      }

      await interaction.reply({ content: '<:Positivo:1403203942573150362> Embed editada com sucesso!', flags: InteractionResponseFlags.Ephemeral });
      return;
    }
  }
};