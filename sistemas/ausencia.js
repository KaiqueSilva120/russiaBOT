const path = require('path');
const fs = require('fs').promises;
const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    SlashCommandBuilder,
} = require('discord.js');

// IDs dos canais e cargos (config IDs should come from a file)
const CANAL_SOLICITAR_AUSENCIA = '1403591556019261532';
const CANAL_AUSENCIAS = '1354897177779900597';
const CARGO_AUSENTE = '1354977769309601943';
const AUSENCIA_LOGS_CHANNEL_ID = 'YOUR_LOG_CHANNEL_ID_HERE'; // Replace with your actual log channel ID

// IDs para os emojis
const EMOJI_AVISOS = '<:avisos:1402749723634303060>';
const EMOJI_WARNING = '<a:c_warningrgbFXP:1403098424689033246>';
const EMOJI_RELOGIO = '<a:relogio:1403118839557918770>';
const EMOJI_POSITIVO = '<a:positivo:1402749751056797707>';
const EMOJI_NEGATIVO = '<a:negativo:1402749793553350806>';

// URL da imagem fixa
const IMAGEM_AUSENCIA = 'https://cdn.discordapp.com/attachments/1242690408782495757/1403224241582637146/AUSENCIA.png?ex=6896c5e9&is=68957469&hm=b312cc572439e741676a082ddd2cc2c5dff32c7710a2a36fdaa8f17d2a13d2bc&';

const BANCO_DIR = path.resolve(__dirname, '..', 'banco');
const AUSENCIAS_FILE = path.join(BANCO_DIR, 'ausencias.json');

let ausencias = {};

/**
 * Carrega as ausências do arquivo JSON.
 */
async function loadAusencias() {
    try {
        const data = await fs.readFile(AUSENCIAS_FILE, 'utf8');
        ausencias = JSON.parse(data);
    } catch (error) {
        console.error('[Ausencia.js] Arquivo de ausências não encontrado, inicializando um novo objeto...');
        ausencias = {};
        await saveAusencias();
    }
}

/**
 * Salva as ausências no arquivo JSON.
 */
async function saveAusencias() {
    try {
        const data = JSON.stringify(ausencias, null, 2);
        await fs.writeFile(AUSENCIAS_FILE, data, 'utf8');
    } catch (error) {
        console.error('[Ausencia.js] Erro ao salvar o arquivo de ausências:', error);
    }
}

/**
 * Envia a mensagem fixa de ausência.
 * @param {Channel} channel - O canal para enviar a mensagem.
 * @param {User} clientUser - O usuário do bot.
 */
async function sendFixedAbsenceMessage(channel, clientUser) {
    const embed = new EmbedBuilder()
        .setColor('#0000FF')
        .setTitle(`${EMOJI_AVISOS} SOLICITAR AUSÊNCIA - RUSSIA`)
        .setDescription(
            `> - Para solicitar sua ausência, clique no botão abaixo e explique o motivo e informe a data que irá retornar\n\n${EMOJI_WARNING} Caso sua ausência termine antes do previsto, clique na função de Sair de Ausência, Não entre em ação antes da tag ser removida!`
        )
        .setImage(IMAGEM_AUSENCIA)
        .setThumbnail(clientUser.displayAvatarURL());

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId('solicitar_ausencia_btn')
            .setLabel('Solicitar Ausencia')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(EMOJI_RELOGIO),
        );

    await channel.send({
        embeds: [embed],
        components: [row]
    });
}

// Lógica principal do sistema
module.exports = (client) => {
    // Define o comando de barra para o sistema de gerenciamento de comandos
    const ausentesListaCommand = {
        data: new SlashCommandBuilder()
            .setName('ausenteslista')
            .setDescription('Lista todos os membros atualmente em ausência.'),
        async execute(interaction) {
            await interaction.deferReply();

            if (Object.keys(ausencias).length === 0) {
                return interaction.editReply('Não há membros em ausência no momento.');
            }

            const embed = new EmbedBuilder()
                .setColor('#ff4242')
                .setTitle(`${EMOJI_RELOGIO} LISTA DE MEMBROS EM AUSENCIA`)
                .setThumbnail(client.user.displayAvatarURL({
                    dynamic: true
                }));

            for (const userId in ausencias) {
                const ausencia = ausencias[userId];
                const user = await client.users.fetch(ausencia.userId);
                embed.addFields({
                    name: ``,
                    value: `
Membro: <@${ausencia.userId}>
RG do membro: \`${ausencia.rg}\`
Motivo da Ausência: ${ausencia.motivo}
Data de Entrada: ${ausencia.dataEntrada}
Data de Retorno: ${ausencia.dataRetorno}
Previsão de Retorno: <t:${ausencia.retornoTimestamp}:R>
Ausencia: [Clique aqui para ver a Ausencia](https://discord.com/channels/${ausencia.guildId}/${ausencia.channelId}/${ausencia.messageId})
`,
                    inline: false
                }, {
                    name: '\u200B',
                    value: '--------------',
                    inline: false
                });
            }

            await interaction.editReply({
                embeds: [embed]
            });
        },
    };

    client.commands.set(ausentesListaCommand.data.name, ausentesListaCommand);

    // Lógica de verificação para expiração de ausências
    setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        await loadAusencias(); // Recarrega os dados para ter a versão mais recente

        for (const userId in ausencias) {
            const ausencia = ausencias[userId];
            if (now >= ausencia.retornoTimestamp) {
                const guild = client.guilds.cache.get(ausencia.guildId);
                if (guild) {
                    const member = guild.members.cache.get(ausencia.userId);
                    if (member) {
                        const cargoAusente = guild.roles.cache.get(CARGO_AUSENTE);
                        if (cargoAusente) {
                            await member.roles.remove(cargoAusente).catch(console.error);
                        }
                    }
                }

                const canalAusencias = client.channels.cache.get(ausencia.channelId);
                if (canalAusencias) {
                    const originalMessage = await canalAusencias.messages.fetch(ausencia.messageId);
                    if (originalMessage) {
                        const originalEmbed = originalMessage.embeds[0];
                        const newEmbed = EmbedBuilder.from(originalEmbed)
                            .setColor('#4287f5')
                            .addFields({
                                name: 'Ausência Expirada:',
                                value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
                                inline: false
                            });

                        await originalMessage.edit({
                            embeds: [newEmbed],
                            components: []
                        });
                    }
                }

                // Envia log de ausência expirada
                const logChannel = client.channels.cache.get(AUSENCIA_LOGS_CHANNEL_ID);
                if (logChannel) {
                    logChannel.send({
                        content: `<@${ausencia.userId}> (RG: ${ausencia.rg}) teve sua ausência expirada.`
                    });
                }

                delete ausencias[userId];
                await saveAusencias();
            }
        }
    }, 60000);

    client.once('ready', async () => {
        await loadAusencias();

        const canalSolicitar = client.channels.cache.get(CANAL_SOLICITAR_AUSENCIA);
        if (canalSolicitar && canalSolicitar.isTextBased()) {
            try {
                const messages = await canalSolicitar.messages.fetch({
                    limit: 10
                });
                const fixedMessage = messages.find(msg =>
                    msg.author.id === client.user.id &&
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title.includes('SOLICITAR AUSÊNCIA')
                );

                if (!fixedMessage) {
                    console.log('[Ausencia.js] Mensagem fixa não encontrada, enviando novamente.');
                    await sendFixedAbsenceMessage(canalSolicitar, client.user);
                }
            } catch (error) {
                console.error('[Ausencia.js] Erro ao verificar a mensagem fixa:', error);
            }
        }
    });

    client.on('interactionCreate', async interaction => {
        const isAusenciaInteraction =
            (interaction.isButton() && (interaction.customId === 'solicitar_ausencia_btn' || interaction.customId.startsWith('retorno_'))) ||
            (interaction.isModalSubmit() && interaction.customId === 'ausencia_modal');

        if (!isAusenciaInteraction) {
            return;
        }

        if (interaction.isButton() && interaction.customId === 'solicitar_ausencia_btn') {
            const modal = new ModalBuilder()
                .setCustomId('ausencia_modal')
                .setTitle('Solicitar Ausência');

            const rgInput = new TextInputBuilder()
                .setCustomId('rg_input')
                .setLabel('RG:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 19713')
                .setRequired(true);

            const motivoInput = new TextInputBuilder()
                .setCustomId('motivo_input')
                .setLabel('Motivo da Ausência:')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Ex: Problemas pessoais, Viagem, etc.')
                .setRequired(true);

            const entradaInput = new TextInputBuilder()
                .setCustomId('data_entrada_input')
                .setLabel('Data de Entrada:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: DD/MM/AAAA')
                .setRequired(true);

            const retornoInput = new TextInputBuilder()
                .setCustomId('data_retorno_input')
                .setLabel('Data de Retorno:')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: DD/MM/AAAA')
                .setRequired(true);

            const firstRow = new ActionRowBuilder().addComponents(rgInput);
            const secondRow = new ActionRowBuilder().addComponents(motivoInput);
            const thirdRow = new ActionRowBuilder().addComponents(entradaInput);
            const fourthRow = new ActionRowBuilder().addComponents(retornoInput);

            modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

            await interaction.showModal(modal);
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId === 'ausencia_modal') {
            await interaction.deferReply({
                ephemeral: true
            });

            const rg = interaction.fields.getTextInputValue('rg_input');
            const motivo = interaction.fields.getTextInputValue('motivo_input');
            const dataEntrada = interaction.fields.getTextInputValue('data_entrada_input');
            const dataRetorno = interaction.fields.getTextInputValue('data_retorno_input');

            const dataRetornoParts = dataRetorno.split('/');
            const retornoTimestamp = new Date(
                `${dataRetornoParts[2]}-${dataRetornoParts[1]}-${dataRetornoParts[0]}T23:59:59`
            ).getTime() / 1000;

            const member = interaction.guild.members.cache.get(interaction.user.id);
            if (member) {
                const cargoAusente = interaction.guild.roles.cache.get(CARGO_AUSENTE);
                if (cargoAusente) {
                    await member.roles.add(cargoAusente).catch(console.error);
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#0000FF')
                .setTitle(`${EMOJI_RELOGIO} Ausência Informada`)
                .setImage(IMAGEM_AUSENCIA)
                .setThumbnail(interaction.user.displayAvatarURL({
                    dynamic: true
                }))
                .addFields({
                    name: 'Membro:',
                    value: `<@${interaction.user.id}>`,
                    inline: false
                }, {
                    name: 'RG do membro:',
                    value: `\`${rg}\``,
                    inline: false
                }, {
                    name: 'Motivo da Ausência:',
                    value: `${motivo}`,
                    inline: false
                }, {
                    name: 'Data de Entrada:',
                    value: `${dataEntrada}`,
                    inline: false
                }, {
                    name: 'Data de Retorno:',
                    value: `${dataRetorno}`,
                    inline: false
                }, {
                    name: 'Previsão de Retorno:',
                    value: `<t:${retornoTimestamp}:R>`,
                    inline: false
                });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                    .setCustomId(`retorno_${interaction.user.id}`)
                    .setLabel('Sair de Ausência')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(EMOJI_POSITIVO),
                );

            const canalAusencias = interaction.guild.channels.cache.get(CANAL_AUSENCIAS);
            if (canalAusencias) {
                const sentMessage = await canalAusencias.send({
                    embeds: [embed],
                    components: [row]
                });

                ausencias[interaction.user.id] = {
                    userId: interaction.user.id,
                    messageId: sentMessage.id,
                    channelId: sentMessage.channel.id,
                    guildId: interaction.guild.id,
                    rg,
                    motivo,
                    dataEntrada,
                    dataRetorno,
                    retornoTimestamp
                };

                await saveAusencias();

                // Envia log de solicitação de ausência
                const logChannel = interaction.guild.channels.cache.get(AUSENCIA_LOGS_CHANNEL_ID);
                if (logChannel) {
                    logChannel.send({
                        content: `<@${interaction.user.id}> (RG: ${rg}) solicitou uma ausência com o motivo: "${motivo}" e retorno em ${dataRetorno}.`
                    });
                }

                await interaction.editReply({
                    content: '<a:positivo:1402749751056797707> Sua ausência foi registrada com sucesso!',
                });
            }
        }

        if (interaction.isButton() && interaction.customId.startsWith('retorno_')) {
            const userId = interaction.customId.split('_')[1];

            if (userId !== interaction.user.id) {
                return interaction.reply({
                    content: `${EMOJI_NEGATIVO} Você só pode dar saída da sua própria ausência.`,
                    ephemeral: true
                });
            }

            const ausencia = ausencias[userId];
            if (!ausencia) {
                return interaction.reply({
                    content: `${EMOJI_NEGATIVO} Não foi possível encontrar sua ausência.`,
                    ephemeral: true
                });
            }

            await interaction.deferReply({
                ephemeral: true
            });

            const member = interaction.guild.members.cache.get(userId);
            if (member) {
                const cargoAusente = interaction.guild.roles.cache.get(CARGO_AUSENTE);
                if (cargoAusente) {
                    await member.roles.remove(cargoAusente).catch(console.error);
                }
            }

            const canalAusencias = interaction.guild.channels.cache.get(ausencia.channelId);
            if (canalAusencias) {
                const originalMessage = await canalAusencias.messages.fetch(ausencia.messageId);
                if (originalMessage) {
                    const originalEmbed = originalMessage.embeds[0];
                    const newEmbed = EmbedBuilder.from(originalEmbed)
                        .setColor('#008000')
                        .addFields({
                            name: 'Retorno Antecipado:',
                            value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
                            inline: false
                        });

                    await originalMessage.edit({
                        embeds: [newEmbed],
                        components: []
                    });

                    // Envia log de retorno antecipado
                    const logChannel = interaction.guild.channels.cache.get(AUSENCIA_LOGS_CHANNEL_ID);
                    if (logChannel) {
                        logChannel.send({
                            content: `<@${userId}> (RG: ${ausencia.rg}) retornou de sua ausência antes do previsto.`
                        });
                    }

                    delete ausencias[userId];
                    await saveAusencias();
                }
            }

            await interaction.editReply({
                content: `${EMOJI_POSITIVO} Você saiu da sua ausência. O cargo foi removido.`,
            });
        }
    });
};