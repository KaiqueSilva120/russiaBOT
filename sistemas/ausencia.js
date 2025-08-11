const connectToDatabase = require('../database');
const Ausencia = require('../models/Ausencia');
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
const AUSENCIA_LOGS_CHANNEL_ID = '1403603952234397728';

// IDs para os emojis
const EMOJI_AVISOS = '<:avisos:1402749723634303060>';
const EMOJI_WARNING = '<a:c_warningrgbFXP:1403098424689033246>';
const EMOJI_RELOGIO = '<a:relogio:1403118839557918770>';
const EMOJI_POSITIVO = '<a:positivo:1402749751056797707>';
const EMOJI_NEGATIVO = '<a:negativo:1402749793553350806>';
const EMOJI_SLASHCOMMANDS = '<:SlashCommands:1402754768702672946>';

// URL da imagem fixa
const IMAGEM_AUSENCIA = 'https://cdn.discordapp.com/attachments/1242690408782495757/1403224241582637146/AUSENCIA.png?ex=6896c5e9&is=68957469&hm=b312cc572439e741676a082ddd2cc2c5dff32c7710a2a36fdaa8f17d2a13d2bc&';

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
    // Conecta ao banco de dados ao iniciar
    connectToDatabase();

    // Lógica de verificação para expiração de ausências
    setInterval(async () => {
        const now = Math.floor(Date.now() / 1000);
        const ausenciasExpiradas = await Ausencia.find({
            retornoTimestamp: {
                $lte: now
            }
        });

        for (const ausencia of ausenciasExpiradas) {
            const guild = client.guilds.cache.get(ausencia.guildId);
            if (guild) {
                const member = guild.members.cache.get(ausencia.memberId);
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
                    }).catch(err => console.error(`[ERRO AO EDITAR MENSAGEM] Ausência Expirada:`, err));
                }
            }
            
            // Envia log de ausência expirada
            const logChannel = client.channels.cache.get(AUSENCIA_LOGS_CHANNEL_ID);
            if (logChannel) {
                logChannel.send({
                    content: `${EMOJI_SLASHCOMMANDS} | O Membro <@${ausencia.memberId}> saiu de ausência ao atingir a data de retorno.`
                }).catch(err => console.error(`[ERRO AO ENVIAR LOG] Ausência Expirada:`, err));
            }

            await Ausencia.findByIdAndDelete(ausencia._id);
        }
    }, 60000);

    client.once('ready', async () => {
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

            // Adicionando a verificação para ausência existente
            const ausenciaExistente = await Ausencia.findOne({
                memberId: interaction.user.id
            });
            if (ausenciaExistente) {
                await interaction.editReply({
                    content: `${EMOJI_NEGATIVO} Você já possui uma ausência ativa registrada no banco de dados. Por favor, saia da ausência anterior antes de solicitar uma nova.`,
                });
                return;
            }

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

                const novaAusencia = new Ausencia({
                    memberId: interaction.user.id,
                    memberName: interaction.user.tag,
                    motivo: motivo,
                    dataSaida: dataEntrada,
                    dataRetorno: dataRetorno,
                    moderadorId: interaction.user.id,
                    guildId: interaction.guild.id,
                    messageId: sentMessage.id,
                    channelId: sentMessage.channel.id,
                    rg: rg,
                    retornoTimestamp: retornoTimestamp
                });

                await novaAusencia.save();
                
                // Envia log de solicitação de ausência para o canal de logs
                const logChannel = interaction.guild.channels.cache.get(AUSENCIA_LOGS_CHANNEL_ID);
                if (logChannel) {
                    logChannel.send({
                        content: `${EMOJI_SLASHCOMMANDS} | O Membro <@${interaction.user.id}> entrou em ausência. Link: ${sentMessage.url}`
                    }).catch(err => console.error(`[ERRO AO ENVIAR LOG] Solicitação de ausência:`, err));
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

            const ausencia = await Ausencia.findOne({
                memberId: userId
            });

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
                try {
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
                        }).catch(err => console.error(`[ERRO AO EDITAR MENSAGEM] Retorno Antecipado:`, err));
                        
                        // Envia log de retorno antecipado para o canal de logs
                        const logChannel = interaction.guild.channels.cache.get(AUSENCIA_LOGS_CHANNEL_ID);
                        if (logChannel) {
                            logChannel.send({
                                content: `${EMOJI_SLASHCOMMANDS} | O Membro <@${userId}> saiu de ausência ao clicar em Sair da Ausência. Link: ${originalMessage.url}`
                            }).catch(err => console.error(`[ERRO AO ENVIAR LOG] Retorno Antecipado:`, err));
                        }

                        await Ausencia.findByIdAndDelete(ausencia._id);
                    }
                } catch (error) {
                    console.error(`[ERRO AO BUSCAR MENSAGEM] O membro tentou sair de ausência, mas a mensagem não foi encontrada:`, error);
                }
            }

            await interaction.editReply({
                content: `${EMOJI_POSITIVO} Você saiu da sua ausência. O cargo foi removido.`,
            });
        }
    });
};