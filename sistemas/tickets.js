const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const Ticket = require('../models/Ticket'); // Importa o modelo Ticket
const connectToDatabase = require('../database'); // Importa a função de conexão
const discordTranscripts = require('discord-html-transcripts');

// --- Configurações Importantes ---
const GUILD_ID = '1354890930746036516';
const ATENDIMENTO_CHANNEL_ID = '1404335936262897694';
const CATEGORIA_TICKET_ID = '1383892559713140857';
const GESTAO_ROLE_ID = '1354891875844100278';
const LOG_CHANNEL_ID = '1383886201454460980';

// --- Variáveis Globais ---
// Usaremos um mapa para manter os tickets em cache em memória para acesso rápido
let ticketsCache = new Map();

// --- Funções Auxiliares ---

/**
 * Converte o tipo de ticket para um formato mais legível para exibição.
 * Ex: "suporte-geral" -> "Suporte Geral"
 * @param {string} type - O tipo de ticket no formato kebab-case.
 * @returns {string} O tipo de ticket formatado.
 */
function formatTicketType(type) {
    if (type === 'suporte') return 'Geral';
    if (type === 'bugs') return 'Bugs';
    if (type === 'patrocinio') return 'Patrocinio';
    if (type === 'denuncia') return 'Denuncia';
    return type.split('-')
               .map(word => word.charAt(0).toUpperCase() + word.slice(1))
               .join(' ');
}

/**
 * Carrega os tickets existentes do banco de dados para o cache.
 */
async function loadTicketsFromDatabase() {
    try {
        await connectToDatabase();
        const ticketsArray = await Ticket.find();
        ticketsArray.forEach(ticket => {
            ticketsCache.set(ticket.channelId, ticket);
        });
        console.log(`[SISTEMA DE TICKETS] Carregou ${ticketsCache.size} tickets do banco de dados.`);
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao carregar tickets do banco de dados:', error);
    }
}

/**
 * Salva um ticket no banco de dados.
 * @param {object} ticketData - Os dados do ticket.
 */
async function saveTicketToDatabase(ticketData) {
    try {
        const newTicket = new Ticket(ticketData);
        await newTicket.save();
        ticketsCache.set(newTicket.channelId, newTicket);
        console.log(`[SISTEMA DE TICKETS] Ticket ${newTicket.channelId} salvo no banco de dados.`);
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao salvar ticket no banco de dados:', error);
    }
}

/**
 * Atualiza um ticket existente no banco de dados.
 * @param {string} channelId - O ID do canal do ticket.
 * @param {object} updateData - Os dados a serem atualizados.
 */
async function updateTicketInDatabase(channelId, updateData) {
    try {
        const updatedTicket = await Ticket.findOneAndUpdate({ channelId }, updateData, { new: true });
        if (updatedTicket) {
            ticketsCache.set(updatedTicket.channelId, updatedTicket);
        }
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao atualizar ticket no banco de dados:', error);
    }
}

/**
 * Remove um ticket do banco de dados e do cache.
 * @param {string} channelId - O ID do canal do ticket.
 */
async function deleteTicketFromDatabase(channelId) {
    try {
        await Ticket.deleteOne({ channelId });
        ticketsCache.delete(channelId);
        console.log(`[SISTEMA DE TICKETS] Ticket ${channelId} deletado do banco de dados.`);
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao deletar ticket do banco de dados:', error);
    }
}

/**
 * Envia a mensagem de atendimento fixa no canal especificado.
 * @param {Channel} channel - O canal onde a mensagem deve ser enviada.
 * @param {Client} client - A instância do cliente Discord.
 * @returns {Promise<Message>} A mensagem enviada.
 */
async function sendAtendimentoMessage(channel, client) {
    const embed = new EmbedBuilder()
        .setTitle('<:ticket:1403190480480764008> Central de Atendimento – Rússia')
        .setDescription(
            `- Seja bem vindo a central de atendimento da nossa Organização.\n\n` +
            `Selecione abaixo a **categoria mais adequada** ao seu caso para abrir um ticket com a nossa equipe.\n\n` +
            `<a:relogio:1403118839557918770> **Horário de Atendimento:**\n` +
            `**08h00 às 00h00** – Todos os dias (Horário de Brasília)\n` +
            `> *Atendimentos fora desse horário podem ocorrer, mas não são garantidos.*\n\n` +
            `<a:c_warningrgbFXP:1403098424689033246> **Importante:**\n` +
            `* Utilize a categoria correta para evitar o encerramento do ticket.\n` +
            `* A criação de tickets indevidos pode resultar em punições.\n` +
            `* Tenha paciência. Nossa equipe responderá assim que possível.`
        )
        .setImage('https://cdn.discordapp.com/attachments/1377779829310623825/1377779927784624319/BannerTicket.png?ex=6895d54c&is=689483cc&hm=9858cd6e99abcf8aced5e7048f52f36654b03b2ba27d7d897cc81402aad4f4af&')
        .setThumbnail(client.user.displayAvatarURL());

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('Escolha uma categoria')
        .addOptions([
            {
                label: 'Suporte Geral',
                description: 'Esclareça duvidas e solicite suporte',
                value: 'suporte',
                emoji: { id: '1403119768806096898' }
            },
            {
                label: 'Reporte Bugs',
                description: 'Reporte Bugs ou problemas com o BOT',
                value: 'bugs',
                emoji: { id: '1391513135101513828' }
            },
            {
                label: 'Patrocinio',
                description: 'Seja Patrocinador e Apoiador',
                value: 'patrocinio',
                emoji: { id: '1403120325754880020' }
            },
            {
                label: 'Denuncie Membros',
                description: 'Denuncie e reporte membros da Org',
                value: 'denuncia',
                emoji: { id: '1403120687329181698' }
            }
        ]);

    const actionRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    const message = await channel.send({ embeds: [embed], components: [actionRow] });
    return message;
}

/**
 * Fecha um ticket, transcreve a conversa e envia para o canal de log e DM do usuário.
 * @param {TextChannel} channel - O canal do ticket a ser fechado.
 * @param {object} ticketInfo - As informações do ticket.
 * @param {GuildMember} closerMember - O membro que está fechando o ticket.
 * @param {string|null} closeReason - O motivo do fechamento, se houver.
 * @param {Client} client - A instância do cliente Discord.
 */
async function closeTicket(channel, ticketInfo, closerMember, closeReason = null, client) {
    try {
        const owner = await client.users.fetch(ticketInfo.ownerId).catch(() => null);
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        
        // Transcreve o canal usando a nova biblioteca
        const transcript = await discordTranscripts.createTranscript(channel, {
            limit: -1, 
            returnBuffer: false,
            fileName: `transcript-${channel.id}.html`
        });

        const transcriptEmbed = new EmbedBuilder()
            .setTitle(`<a:low_bot:1402749493551566899> TRANSCRIÇÃO DO TICKET: ${formatTicketType(ticketInfo.type)} - ${owner ? owner.username : 'Desconhecido'}`)
            .setDescription(
                `Olá, seu ticket foi encerrado. Abaixo estão os detalhes do atendimento.\n\n` +
                `<a:fixclandst:1402749610040098908> Tipo de Ticket: ${formatTicketType(ticketInfo.type)}\n` +
                (closeReason ? `<a:c_warningrgbFXP:1403098424689033246> Motivo: ${closeReason}\n` : '') +
                `<a:lupa:1403599767501672580> ID do Ticket: \`${channel.id}\`\n` +
                `<:azul:1403119768806096898> Autor do Ticket: ${owner ? `<@${owner.id}> (${owner.tag})` : 'Desconhecido'}\n` +
                `<:ban:1403120687329181698> Encerrado Por: <@${closerMember.id}> (${closerMember.user.tag})\n` +
                `<a:relogio:1403118839557918770> Data e Hora de Encerramento: ${new Date().toLocaleString('pt-BR')}`
            )
            .setFooter({ text: `Gerenciamento Tickets - Rússia | ${new Date().toLocaleDateString('pt-BR')}` })
            .setThumbnail(client.user.displayAvatarURL());

        if (logChannel) {
            await logChannel.send({ embeds: [transcriptEmbed], files: [transcript] }).catch(console.error);
        }

        if (owner) {
            try {
                await owner.send({ embeds: [transcriptEmbed], files: [transcript] });
            } catch (dmError) {
                console.warn(`[SISTEMA DE TICKETS] Não foi possível enviar a DM para ${owner.tag}:`, dmError);
            }
        }

        // Deleta o ticket do banco de dados e do cache
        await deleteTicketFromDatabase(channel.id);
        await channel.delete().catch(console.error);
    } catch (error) {
        console.error('[SISTEMA DE TICKETS] Erro ao fechar o ticket:', error);
    }
}

/**
 * Função de setup para inicializar e gerenciar o sistema de tickets.
 * Exportada para ser carregada pelo index.js.
 * @param {Client} client - A instância do cliente Discord.
 */
function setup(client) {
    if (!client.options.partials.includes(Partials.Channel)) {
        client.options.partials.push(Partials.Channel);
    }
    if (!client.options.partials.includes(Partials.Message)) {
        client.options.partials.push(Partials.Message);
    }
    if (!client.options.partials.includes(Partials.User)) {
        client.options.partials.push(Partials.User);
    }
    
    // Carrega os tickets do banco de dados ao iniciar
    loadTicketsFromDatabase();

    client.once('ready', async () => {
        console.log(`[SISTEMA DE TICKETS] Iniciado para ${client.user.tag}!`);
        const channel = await client.channels.fetch(ATENDIMENTO_CHANNEL_ID).catch(() => null);
        if (!channel) return console.error('[SISTEMA DE TICKETS] Canal de atendimento não encontrado. Verifique o ID.');

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        const fixedMessage = messages ? messages.find(msg =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title === '<:ticket:1403190480480764008> Central de Atendimento – Rússia'
        ) : null;

        if (fixedMessage) {
            console.log('[SISTEMA DE TICKETS] Mensagem fixa de atendimento encontrada. Nada a fazer.');
        } else {
            console.log('[SISTEMA DE TICKETS] Mensagem fixa de atendimento não encontrada. Enviando uma nova...');
            await sendAtendimentoMessage(channel, client);
        }
    });

    client.on('interactionCreate', async interaction => {
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
            const selectedOption = interaction.values[0];

            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_${selectedOption}`)
                .setTitle('Informe o motivo:');

            const reasonInput = new TextInputBuilder()
                .setCustomId('ticket_reason')
                .setLabel('Qual o motivo do seu atendimento?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
            return;
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('ticket_modal_') ||
                interaction.customId === 'close_ticket_reason_modal' ||
                interaction.customId === 'add_member_modal' ||
                interaction.customId === 'remove_member_modal')
            {
                if (interaction.customId.startsWith('ticket_modal_')) {
                    await interaction.deferReply({ ephemeral: true });

                    const ticketType = interaction.customId.replace('ticket_modal_', '');
                    const reason = interaction.fields.getTextInputValue('ticket_reason');

                    const guild = interaction.guild;
                    const member = interaction.member;

                    const channelName = `🎫・${ticketType.toLowerCase().replace(/[^a-z0-9]/g, '')}-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

                    try {
                        const ticketChannel = await guild.channels.create({
                            name: channelName,
                            type: ChannelType.GuildText,
                            parent: CATEGORIA_TICKET_ID,
                            permissionOverwrites: [
                                {
                                    id: guild.id,
                                    deny: [PermissionsBitField.Flags.ViewChannel],
                                },
                                {
                                    id: member.id,
                                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                                },
                                {
                                    id: GESTAO_ROLE_ID,
                                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                                },
                            ],
                        });

                        const newTicketData = {
                            channelId: ticketChannel.id,
                            ownerId: member.id,
                            type: ticketType,
                            reason: reason,
                            createdAt: new Date().toISOString(),
                            transcript: []
                        };
                        // Salva o novo ticket no banco de dados
                        await saveTicketToDatabase(newTicketData);

                        const ticketEmbed = new EmbedBuilder()
                            .setTitle(`> <:azul:1403119768806096898> Ticket - ${formatTicketType(ticketType)}`)
                            .setDescription(
                                `> <a:lupa:1403599767501672580> Motivo Informado: **${reason}**\n\n` +
                                `<a:setabranca:1403599822207979562> O atendimento foi iniciado. A nossa equipe verá seu ticket em breve.\n\n` +
                                `> Enquanto aguarda, fique atento às notificações no canal e utilize os botões abaixo caso precise interagir.`
                            )
                            .setThumbnail(member.user.displayAvatarURL())
                            .setImage('https://cdn.discordapp.com/attachments/1377779829310623825/1377779927784624319/BannerTicket.png?ex=6895d54c&is=689483cc&hm=9858cd6e99abcf8aced5e7048f52f36654b03b2ba27d7d897cc81402aad4f4af&');

                        const buttonsRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                                new ButtonBuilder().setCustomId('fechar_ticket_motivo').setLabel('Fechar com Motivo').setStyle(ButtonStyle.Danger).setEmoji('🛑'),
                                new ButtonBuilder().setCustomId('gerenciar_ticket').setLabel('Gerenciar Ticket').setStyle(ButtonStyle.Secondary).setEmoji('1403190480480764008')
                            );

                        await ticketChannel.send({
                            content: `Você Abriu um Suporte privado com a Alta Cúpula da Rússia\n|| <@${member.id}> | <@&${GESTAO_ROLE_ID}> ||`,
                            embeds: [ticketEmbed],
                            components: [buttonsRow]
                        });

                        await interaction.followUp({ content: `Seu ticket foi aberto em ${ticketChannel}!`, ephemeral: true });

                    } catch (error) {
                        console.error('[SISTEMA DE TICKETS] Erro ao abrir o ticket:', error);
                        await interaction.followUp({ content: 'Ocorreu um erro ao abrir seu ticket. Tente novamente mais tarde.', ephemeral: true });
                    }
                } else if (interaction.customId === 'close_ticket_reason_modal') {
                    await interaction.deferUpdate();
                    const closeReason = interaction.fields.getTextInputValue('close_reason_input');
                    const ticketInfo = ticketsCache.get(interaction.channel.id);
                    if (!ticketInfo) {
                        return interaction.followUp({ content: 'O ticket não foi encontrado. Talvez já tenha sido fechado.', ephemeral: true });
                    }
                    await closeTicket(interaction.channel, ticketInfo, interaction.member, closeReason, client);
                } else if (interaction.customId === 'add_member_modal') {
                    await interaction.deferUpdate();
                    const ticketInfo = ticketsCache.get(interaction.channel.id);
                    if (!ticketInfo) return interaction.followUp({ content: 'O ticket não foi encontrado. Talvez já tenha sido fechado.', ephemeral: true });
                    if (!interaction.member.roles.cache.has(GESTAO_ROLE_ID)) {
                        return interaction.followUp({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode adicionar membros.', ephemeral: true});
                    }

                    const memberIdentifier = interaction.fields.getTextInputValue('member_id_input');
                    let targetMember;

                    try {
                        const memberId = memberIdentifier.replace(/[^0-9]/g, '');
                        targetMember = await interaction.guild.members.fetch(memberId);
                    } catch (e) {
                        console.warn(`[SISTEMA DE TICKETS] Não foi possível encontrar membro por ID: ${memberIdentifier}. Tentando buscar por nome (menos preciso).`);
                        targetMember = interaction.guild.members.cache.find(m =>
                            m.user.username.toLowerCase() === memberIdentifier.toLowerCase() ||
                            m.nickname?.toLowerCase() === memberIdentifier.toLowerCase()
                        );
                    }

                    if (targetMember) {
                        const currentPermissions = interaction.channel.permissionOverwrites.cache.get(targetMember.id);
                        if (currentPermissions && currentPermissions.allow.has(PermissionsBitField.Flags.ViewChannel)) {
                            return interaction.followUp({ content: `<:alerta:1398025586675122170> | O membro <@${targetMember.id}> já possui acesso a este ticket.`, ephemeral: true });
                        }

                        await interaction.channel.permissionOverwrites.edit(targetMember.id, {
                            ViewChannel: true,
                            SendMessages: true
                        });
                        await interaction.followUp({
                            content: `<a:positivo:1402749751056797707> | Membro <@${targetMember.id}> Adicionado ao ticket por <@${interaction.member.id}>.`,
                            ephemeral: false
                        });
                    } else {
                        await interaction.followUp({ content: 'Não foi possível encontrar o membro especificado. Por favor, use a menção (@membro) ou o ID do membro.', ephemeral: true });
                    }
                } else if (interaction.customId === 'remove_member_modal') {
                    await interaction.deferUpdate();
                    const ticketInfo = ticketsCache.get(interaction.channel.id);
                    if (!ticketInfo) return interaction.followUp({ content: 'O ticket não foi encontrado. Talvez já tenha sido fechado.', ephemeral: true });
                    if (!interaction.member.roles.cache.has(GESTAO_ROLE_ID)) {
                        return interaction.followUp({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode remover membros.', ephemeral: true });
                    }

                    const memberIdentifier = interaction.fields.getTextInputValue('remove_member_id_input');
                    let targetMember;

                    try {
                        const memberId = memberIdentifier.replace(/[^0-9]/g, '');
                        targetMember = await interaction.guild.members.fetch(memberId);
                    } catch (e) {
                        console.warn(`[SISTEMA DE TICKETS] Não foi possível encontrar membro por ID: ${memberIdentifier}. Tentando buscar por nome (menos preciso).`);
                        targetMember = interaction.guild.members.cache.find(m =>
                            m.user.username.toLowerCase() === memberIdentifier.toLowerCase() ||
                            m.nickname?.toLowerCase() === memberIdentifier.toLowerCase()
                        );
                    }

                    if (targetMember) {
                        if (targetMember.id === ticketInfo.ownerId) {
                            return interaction.followUp({ content: 'Você não pode remover o criador do ticket.', ephemeral: true });
                        }

                        const currentPermissions = interaction.channel.permissionOverwrites.cache.get(targetMember.id);
                        if (!currentPermissions || !currentPermissions.allow.has(PermissionsBitField.Flags.ViewChannel)) {
                            return interaction.followUp({ content: `<:alerta:1398025586675122170> | O membro <@${targetMember.id}> já não possui acesso a este ticket.`, ephemeral: true });
                        }

                        await interaction.channel.permissionOverwrites.delete(targetMember.id);
                        await interaction.followUp({
                            content: `<a:negativo:1402749793553350806> | Membro <@${targetMember.id}> Removido do ticket por <@${interaction.member.id}>.`,
                            ephemeral: false
                        });
                    } else {
                        await interaction.followUp({ content: '<:dawae:1369630173376282634> Não foi possível encontrar o membro especificado. Por favor, use a menção (@membro) ou o ID do membro.', ephemeral: true });
                    }
                }
                return;
            }
        }

        if (interaction.isButton() && ticketsCache.has(interaction.channel.id)) {
            const { customId, channel, member } = interaction;
            const ticketInfo = ticketsCache.get(channel.id);

            if (!ticketInfo) {
                if (!interaction.replied && !interaction.deferred) {
                    return interaction.reply({ content: 'Este não é um canal de ticket válido ou o ticket já foi fechado.', ephemeral: true }).catch(e => console.error("Erro ao responder botão de ticket inválido:", e));
                }
                return;
            }

            const isStaff = member.roles.cache.has(GESTAO_ROLE_ID);

            switch (customId) {
                case 'fechar_ticket':
                    if (!isStaff) {
                        return interaction.reply({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode fechar tickets.', ephemeral: true }).catch(e => console.error("Erro ao responder fechar_ticket:", e));
                    }
                    
                    // Altera as permissões para trancar o ticket
                    const allOverwrites = channel.permissionOverwrites.cache.filter(ow => ow.id !== GESTAO_ROLE_ID);
                    for (const ow of allOverwrites.values()) {
                        await channel.permissionOverwrites.edit(ow.id, { ViewChannel: false }).catch(console.error);
                    }
                    
                    // Envia a mensagem com os botões de Deletar e Reabrir
                    const lockedEmbed = new EmbedBuilder()
                        .setTitle('Ticket Trancado')
                        .setDescription('Ticket trancado. Apenas a equipe <@&1354891875844100278> pode ver este canal.')
                        .setColor('ff9900'); // Cor de alerta

                    const lockedButtonsRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder().setCustomId('deletar_ticket').setLabel('Deletar Ticket').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('reabrir_ticket').setLabel('Reabrir Ticket').setStyle(ButtonStyle.Success)
                        );
                    
                    await interaction.reply({
                        embeds: [lockedEmbed],
                        components: [lockedButtonsRow]
                    }).catch(e => console.error("Erro ao responder fechar_ticket:", e));
                    break;

                case 'fechar_ticket_motivo':
                    if (!isStaff) {
                        return interaction.reply({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode usar este botão.', ephemeral: true }).catch(e => console.error("Erro ao responder botão fechar_ticket_motivo:", e));
                    }
                    const closeReasonModal = new ModalBuilder()
                        .setCustomId('close_ticket_reason_modal')
                        .setTitle('Motivo do Fechamento:');

                    const closeReasonInput = new TextInputBuilder()
                        .setCustomId('close_reason_input')
                        .setLabel('Informe o motivo do fechamento do ticket.')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true);

                    closeReasonModal.addComponents(new ActionRowBuilder().addComponents(closeReasonInput));
                    await interaction.showModal(closeReasonModal).catch(e => console.error("Erro ao mostrar modal fechar_ticket_motivo:", e));
                    break;
                
                case 'deletar_ticket':
                    if (!isStaff) {
                        return interaction.reply({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode deletar tickets.', ephemeral: true }).catch(e => console.error("Erro ao responder deletar_ticket:", e));
                    }
                    await interaction.deferUpdate();

                    const deletingEmbed = new EmbedBuilder()
                        .setDescription('<a:info:1402749673076166810> Transcrevendo e Fechando o ticket....')
                        .setColor('ff0000'); // Cor vermelha

                    await interaction.editReply({ embeds: [deletingEmbed], components: [] }).catch(e => console.error("Erro ao editar mensagem de deleção:", e));

                    setTimeout(async () => {
                        await closeTicket(channel, ticketInfo, member, null, client);
                    }, 5000);
                    break;

                case 'reabrir_ticket':
                    if (!isStaff) {
                        return interaction.reply({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode reabrir tickets.', ephemeral: true }).catch(e => console.error("Erro ao responder reabrir_ticket:", e));
                    }
                    await interaction.deferUpdate();
                    
                    // Reabilita o canal para o criador do ticket
                    await channel.permissionOverwrites.edit(ticketInfo.ownerId, { ViewChannel: true, SendMessages: true });
                    
                    const reopenedEmbed = new EmbedBuilder()
                        .setTitle('Ticket Reaberto')
                        .setDescription(`O ticket foi reaberto por <@${member.id}>.`)
                        .setColor('00ff00'); // Cor verde
                    
                    await interaction.editReply({ embeds: [reopenedEmbed], components: [] }).catch(e => console.error("Erro ao editar mensagem de reabertura:", e));
                    break;

                case 'gerenciar_ticket':
                    if (!isStaff) {
                        return interaction.reply({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode gerenciar tickets.', ephemeral: true }).catch(e => console.error("Erro ao responder gerenciar_ticket:", e));
                    }
                    const manageEmbed = new EmbedBuilder()
                        .setTitle('<:ticket:1403190480480764008> Gerencie o ticket com as opções abaixo:');

                    const manageButtonsRow1 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder().setCustomId('notificar_usuario').setLabel('Notificar Usuário').setStyle(ButtonStyle.Primary).setEmoji('🔔'),
                            new ButtonBuilder().setCustomId('notificar_equipe').setLabel('Chamar Equipe').setStyle(ButtonStyle.Secondary).setEmoji('📣')
                        );
                    
                    const manageButtonsRow2 = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder().setCustomId('adicionar_membro').setLabel('Adicionar Membro').setStyle(ButtonStyle.Success).setEmoji('➕'),
                            new ButtonBuilder().setCustomId('remover_membro').setLabel('Remover Membro').setStyle(ButtonStyle.Danger).setEmoji('➖')
                        );

                    await interaction.reply({
                        embeds: [manageEmbed],
                        components: [manageButtonsRow1, manageButtonsRow2],
                        ephemeral: true
                    }).catch(e => console.error("Erro ao responder gerenciar_ticket:", e));
                    break;

                case 'notificar_usuario':
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: `<a:sino:1403196375541485618> | Olá <@${ticketInfo.ownerId}> você está sendo notificado pela equipe.`,
                            ephemeral: false
                        }).catch(e => console.error("Erro ao responder notificar_usuario:", e));
                    }
                    break;

                case 'notificar_equipe':
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: `<a:sininho:1403196330809229322> | Olá <@&${GESTAO_ROLE_ID}> o Usuário está solicitando sua presença.`,
                            ephemeral: false
                        }).catch(e => console.error("Erro ao responder notificar_equipe:", e));
                    }
                    break;

                case 'adicionar_membro':
                    if (!isStaff) {
                        return interaction.reply({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode adicionar membros.', ephemeral: true }).catch(e => console.error("Erro ao responder botão adicionar_membro:", e));
                    }
                    const addMemberModal = new ModalBuilder()
                        .setCustomId('add_member_modal')
                        .setTitle('Adicionar Membro ao Ticket');

                    const memberIdInput = new TextInputBuilder()
                        .setCustomId('member_id_input')
                        .setLabel('Mencione o membro ou insira o ID:')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    addMemberModal.addComponents(new ActionRowBuilder().addComponents(memberIdInput));
                    await interaction.showModal(addMemberModal).catch(e => console.error("Erro ao mostrar modal adicionar_membro:", e));
                    break;

                case 'remover_membro':
                    if (!isStaff) {
                        return interaction.reply({ content: '<:v_staff:1391511999338250256> Apenas a equipe <@&1354891875844100278> pode remover membros.', ephemeral: true }).catch(e => console.error("Erro ao responder botão remover_membro:", e));
                    }
                    const removeMemberModal = new ModalBuilder()
                        .setCustomId('remove_member_modal')
                        .setTitle('Remover Membro do Ticket');

                    const removeMemberIdInput = new TextInputBuilder()
                        .setCustomId('remove_member_id_input')
                        .setLabel('Mencione o membro ou insira o ID:')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                    removeMemberModal.addComponents(new ActionRowBuilder().addComponents(removeMemberIdInput));
                    await interaction.showModal(removeMemberModal).catch(e => console.error("Erro ao mostrar modal remover_membro:", e));
                    break;
            }
            return;
        }
    });

    client.on('messageCreate', async message => {
        // A lógica de salvar a transcrição mensagem por mensagem no banco de dados
        // foi removida, pois a nova biblioteca busca as mensagens diretamente do canal.
        // Portanto, essa parte do código agora não faz nada, mas foi mantida
        // para não alterar a estrutura da função, como solicitado.
    });
}

module.exports = setup;