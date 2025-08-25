const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    PermissionsBitField,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const connectToDatabase = require('../database');
const Punishment = require('../models/Punishment');

// --- Configurações de Canais e IDs de Cargos ---
const PUNISHED_CHANNEL_ID = '1403593194545086484';
const PUNISHED_LOG_CHANNEL_ID = '1354897156133097572';
const BOT_LOG_CHANNEL_ID = '1403603952234397728';

// IDs dos cargos de punição
const ROLES = {
    LEVE: '1354891761046126884',
    MEDIA: '1354891870093709423',
    GRAVE: '1354891873902264530',
    EXONERACAO: '1403593461021544670',
};

// ID do cargo responsável por usar o painel de punições
const RESPONSIBLE_ROLE_ID = '1354892110113018111';

// Mapeamento de texto para IDs de cargos e dias
const PUNISHMENT_TYPES = {
    'leve': { roleId: ROLES.LEVE, days: 7, name: 'Advertência Leve' },
    'media': { roleId: ROLES.MEDIA, days: 14, name: 'Advertência Média' },
    'grave': { roleId: ROLES.GRAVE, days: 30, name: 'Advertência Grave' },
    'exoneração': { roleId: ROLES.EXONERACAO, days: 0, name: 'Exoneração/PD', unremovable: true },
};

const BANCO_DIR = path.join(__dirname, '../banco');
const REGISTRO_ID_FILE = path.join(BANCO_DIR, 'registroID.json');

// --- Carregar Cargos de Registro do Arquivo ---
let REGISTRATION_ROLES = [];
try {
    if (!fs.existsSync(REGISTRO_ID_FILE)) {
        console.error('Arquivo registroID.json não encontrado. Criando arquivo padrão...');
        if (!fs.existsSync(BANCO_DIR)) fs.mkdirSync(BANCO_DIR, { recursive: true });
        fs.writeFileSync(REGISTRO_ID_FILE, JSON.stringify({ roles: [] }, null, 2), 'utf-8');
    }
    const registroData = JSON.parse(fs.readFileSync(REGISTRO_ID_FILE, 'utf-8'));
    REGISTRATION_ROLES = registroData.roles;
} catch (e) {
    console.error('Erro ao carregar roles do registroID.json:', e);
}


// --- URls das Imagens ---
const DEFAULT_PUNISHMENT_IMAGE = 'https://cdn.discordapp.com/attachments/1242690408782495757/1403222285023838258/PUNICAO_1.png?ex=6896c417&is=68957297&hm=74c900028d1254004f6d77c17828e915a45eb6e63e21db0771b3fb45e8a16d21&';


// --- Funções de Criação de Componentes UI ---

/**
 * Cria os botões para aplicar e remover punições.
 * @returns {ActionRowBuilder} Uma ActionRow contendo os botões.
 */
function createPunishmentButtons() {
    const applyButton = new ButtonBuilder()
        .setCustomId('punish_apply')
        .setLabel('Aplicar Punição')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('<:ban:1403120687329181698>');

    const removeButton = new ButtonBuilder()
        .setCustomId('punish_remove')
        .setLabel('Remover Punição')
        .setStyle(ButtonStyle.Success)
        .setEmoji('<:adicionar:1403214675872579725>');

    return new ActionRowBuilder().addComponents(applyButton, removeButton);
}

/**
 * Cria a embed principal do sistema de punições.
 * @returns {EmbedBuilder} A embed formatada.
 */
function createMainPunishmentEmbed() {
    return new EmbedBuilder()
        .setTitle('<a:warning:1392879344262844437> SISTEMA DE PUNIÇÕES DA RUSSIA')
        .setDescription(
            `> <:ponto:1404150420883898510> Abaixo temos o sistema de punições da rússia e suas respectivas punições abaixo:\n` +
            `> <@&${ROLES.LEVE}> - **7 dias**\n` +
            `> <@&${ROLES.MEDIA}> - **14 dias**\n` +
            `> <@&${ROLES.GRAVE}> - **30 dias**\n` +
            `> <@&${ROLES.EXONERACAO}> - **Exoneração/PD**\n\n` +
            `> Ao selecionar **Exoneração** o mesmo será expulso automaticamente da organização.\n`
        )
        .setImage(DEFAULT_PUNISHMENT_IMAGE)
        .setColor('#FFA500');
}

/**
 * Encontra o cargo mais alto de um membro com base na lista de cargos de registro.
 * @param {GuildMember} member - O objeto GuildMember.
 * @returns {string} O nome do cargo mais alto ou "Não especificado" se nenhum for encontrado.
 */
function getHighestRole(member) {
    if (!member) return 'Não especificado';
    for (const roleInfo of REGISTRATION_ROLES) {
        if (member.roles.cache.has(roleInfo.id)) {
            return roleInfo.name;
        }
    }
    return 'Não especificado';
}

/**
 * Cria a embed de LOG para punição adicionada.
 * @param {Object} punishmentData - Dados da punição.
 * @param {GuildMember} member - O objeto GuildMember do punido.
 * @returns {EmbedBuilder} A embed formatada para o log.
 */
function createPunishmentLogEmbed(punishmentData, member) {
    const fullDisplayName = member.displayName || member.user.username;

    const rgMatch = fullDisplayName.match(/「(\d+)」$/);
    const rg = rgMatch ? rgMatch[1] : 'N/A';

    let nameAndLastName = fullDisplayName.replace(/「.*?」/g, '').trim();
    if (nameAndLastName.startsWith('「') && nameAndLastName.endsWith('」')) {
        nameAndLastName = nameAndLastName.replace(/「.*?」/g, '').trim();
    }

    const memberRole = getHighestRole(member);

    const embed = new EmbedBuilder()
        .setTitle('<:adicionar:1403214675872579725> Punição Adicionada')
        .setColor('#FF0000')
        .setImage(DEFAULT_PUNISHMENT_IMAGE)
        .addFields(
            { name: 'Membro Punido:', value: `<@${punishmentData.memberId}>`, inline: true },
            { name: 'Nome do Punido:', value: nameAndLastName, inline: true },
            { name: 'RG do Punido:', value: `\`${rg}\``, inline: false },
            { name: 'Cargo:', value: memberRole, inline: true },
            { name: 'Motivo:', value: punishmentData.reason },
            { name: 'Punição:', value: `<@&${punishmentData.roleId}>`, inline: true }
        );

    // Lógica para o timestamp dinâmico
    if (punishmentData.punishmentType === 'exoneração') {
        embed.addFields({ name: 'Expira em:', value: 'Permanente', inline: true });
    } else if (punishmentData.expiresAt) {
        const expirationTimestamp = Math.floor(punishmentData.expiresAt / 1000);
        embed.addFields({ name: 'Expira em:', value: `<t:${expirationTimestamp}:R>`, inline: true });
    } else {
        embed.addFields({ name: 'Expira em:', value: 'Não se aplica', inline: true });
    }

    return embed;
}

/**
 * Cria a embed de LOG para punição removida.
 * @param {Object} originalPunishmentData - Dados COMPLETOs da punição original.
 * @returns {EmbedBuilder} A embed formatada para o log de remoção.
 */
function createPunishmentRemovedLogEmbed(originalPunishmentData) {
    const fullDisplayName = originalPunishmentData.memberName;

    const rgMatch = fullDisplayName.match(/「(\d+)」$/);
    const rg = rgMatch ? rgMatch[1] : 'N/A';

    let nameAndLastName = fullDisplayName.replace(/「.*?」/g, '').trim();
    if (nameAndLastName.startsWith('「') && nameAndLastName.endsWith('」')) {
        nameAndLastName = nameAndLastName.replace(/「.*?」/g, '').trim();
    }

    const originalRoleName = originalPunishmentData.highestRole || REGISTRATION_ROLES.find(r => r.id === originalPunishmentData.roleId)?.name || 'Não especificado';

    const embed = new EmbedBuilder()
        .setTitle('<:remover:1403214664946417664> Punição Removida')
        .setColor('#00FF00')
        .setImage(DEFAULT_PUNISHMENT_IMAGE)
        .addFields(
            { name: 'Membro Punido:', value: `<@${originalPunishmentData.memberId}>`, inline: true },
            { name: 'Nome do Punido:', value: nameAndLastName, inline: true },
            { name: 'RG do Punido:', value: `\`${rg}\``, inline: false },
            { name: 'Cargo:', value: originalRoleName, inline: true },
            { name: 'Motivo:', value: originalPunishmentData.reason },
            { name: 'Punição:', value: `<@&${originalPunishmentData.roleId}>`, inline: true }
        );

    // Lógica para o timestamp dinâmico
    if (originalPunishmentData.punishmentType === 'exoneração') {
        embed.addFields({ name: 'Expiração Original:', value: 'Permanente', inline: true });
    } else if (originalPunishmentData.expiresAt) {
        const expirationTimestamp = Math.floor(originalPunishmentData.expiresAt / 1000);
        embed.addFields({ name: 'Expiração Original:', value: `<t:${expirationTimestamp}:R>`, inline: true });
    } else {
        embed.addFields({ name: 'Expiração Original:', value: 'Não se aplica', inline: true });
    }

    return embed;
}

/**
 * Cria a embed de LOG para punição removida automaticamente.
 * @param {Object} expiredPunishmentData - Dados da punição que expirou.
 * @returns {EmbedBuilder} A embed formatada para o log de expiração.
 */
function createPunishmentExpiredLogEmbed(expiredPunishmentData) {
    const fullDisplayName = expiredPunishmentData.memberName;

    const rgMatch = fullDisplayName.match(/「(\d+)」$/);
    const rg = rgMatch ? rgMatch[1] : 'N/A';

    let nameAndLastName = fullDisplayName.replace(/「.*?」/g, '').trim();
    if (nameAndLastName.startsWith('「') && nameAndLastName.endsWith('」')) {
        nameAndLastName = nameAndLastName.replace(/「.*?」/g, '').trim();
    }

    // Usa o nome do cargo que foi salvo no objeto da punição.
    const originalRoleName = expiredPunishmentData.highestRole || 'Não especificado';

    const embed = new EmbedBuilder()
        .setTitle('<a:positivo:1397953846063398933> Punição Expirada Automaticamente')
        .setColor('#00FF00')
        .setImage(DEFAULT_PUNISHMENT_IMAGE)
        .setDescription(
            `A punição de **<@${expiredPunishmentData.memberId}>** expirou e foi removida automaticamente.`
        )
        .addFields(
            { name: 'Membro Punido:', value: `<@${expiredPunishmentData.memberId}>`, inline: true },
            { name: 'Nome do Punido:', value: nameAndLastName, inline: true },
            { name: 'RG do Punido:', value: `\`${rg}\``, inline: false },
            { name: 'Cargo:', value: originalRoleName, inline: true },
            { name: 'Motivo:', value: expiredPunishmentData.reason },
            { name: 'Punição:', value: `<@&${expiredPunishmentData.roleId}>`, inline: true }
        );

    return embed;
}

// --- Funções de Criação de Mensagens de Log Simplificadas ---
/**
 * Cria a mensagem de LOG simplificada para punição aplicada.
 * @param {Object} newPunishment - Dados da punição que foi aplicada.
 * @param {User} punisher - Usuário que aplicou a punição.
 * @returns {string} A string formatada para o log de aplicação.
 */
function createSimplifiedAppliedLogMessage(newPunishment, punisher) {
    const linkToOriginal = newPunishment.logMessageId
        ? ` (https://discord.com/channels/${newPunishment.guildId}/${newPunishment.logChannelId}/${newPunishment.logMessageId})`
        : '';
    return `<:SlashCommands:1402754768702672946> | Uma Punição foi aplicada em <@${newPunishment.memberId}> por <@${punisher.id}>${linkToOriginal}.`;
}

/**
 * Cria a mensagem de LOG simplificada para punição removida manualmente.
 * @param {Object} originalPunishmentData - Dados COMPLETOs da punição original.
 * @param {User} remover - Usuário que removeu a punição.
 * @returns {string} A string formatada para o log de remoção.
 */
function createSimplifiedRemovedLogMessage(originalPunishmentData, remover) {
    const linkToOriginal = originalPunishmentData.logMessageId
        ? ` (https://discord.com/channels/${originalPunishmentData.guildId}/${originalPunishmentData.logChannelId}/${originalPunishmentData.logMessageId})`
        : '';

    return `<:SlashCommands:1402754768702672946> | Punição de <@${originalPunishmentData.memberId}> foi removida por <@${remover.id}>${linkToOriginal}.`;
}

/**
 * Cria a mensagem de LOG simplificada para punição removida automaticamente.
 * @param {Object} expiredPunishmentData - Dados da punição que expirou.
 * @returns {string} A string formatada para o log de expiração.
 */
function createSimplifiedExpiredLogMessage(expiredPunishmentData) {
    const linkToOriginal = expiredPunishmentData.logMessageId
        ? ` (https://discord.com/channels/${expiredPunishmentData.guildId}/${expiredPunishmentData.logChannelId}/${expiredPunishmentData.logMessageId})`
        : '';

    return `<:SlashCommands:1402754768702672946> | Punição de <@${expiredPunishmentData.memberId}> foi removida por expirar o tempo da punição${linkToOriginal}.`;
}


// --- Função para Garantir a Mensagem Fixa ---
/**
 * Garante que o painel de punições esteja presente no canal.
 * Se não houver painel fixado, envia um novo e fixa.
 * @param {Client} client - O cliente Discord.
 */
async function ensurePunishmentMessage(client) {
    const punishmentChannel = await client.channels.fetch(PUNISHED_CHANNEL_ID);
    if (!punishmentChannel || !punishmentChannel.isTextBased()) {
        console.error(`Canal de punições (ID: ${PUNISHED_CHANNEL_ID}) não encontrado ou não é um canal de texto.`);
        return;
    }

    try {
        const pinnedMessages = await punishmentChannel.messages.fetchPinned();
        const existingPanel = pinnedMessages.find(msg =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes('SISTEMA DE PUNIÇÕES')
        );

        if (existingPanel) {
            console.log('[PUNIDOS] Painel já existe e está fixado. Nenhuma ação necessária.');
            return;
        }

        console.log('[PUNIDOS] Nenhum painel encontrado. Criando novo...');
        const mainEmbed = createMainPunishmentEmbed();
        const buttonsRow = createPunishmentButtons();
        const newMessage = await punishmentChannel.send({ embeds: [mainEmbed], components: [buttonsRow] });
        await newMessage.pin('Mensagem principal do sistema de punições.');
        console.log('[PUNIDOS] Novo painel de punições enviado e fixado.');

    } catch (error) {
        console.error('[PUNIDOS] Erro ao verificar/criar painel de punições:', error);
    }
}

// --- Funções Auxiliares de Lógica ---
/**
 * Extrai o ID do usuário de uma menção ou ID direto.
 * @param {Guild} guild - O objeto Guild.
 * @param {string} input - O ID do usuário ou a menção.
 * @returns {string|null} O ID do usuário ou null se não for encontrado.
 */
async function extractUserId(guild, input) {
    const mentionMatch = input.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        return mentionMatch[1];
    }

    if (/^\d+$/.test(input)) {
        return input;
    }

    const member = guild.members.cache.find(m =>
        m.displayName.toLowerCase() === input.toLowerCase() ||
        m.user.username.toLowerCase() === input.toLowerCase() ||
        m.user.tag.toLowerCase() === input.toLowerCase()
    );
    if (member) {
        return member.id;
    }

    return null;
}

/**
 * Verifica e remove punições expiradas.
 * @param {Client} client - O cliente Discord.
 */
async function checkExpiredPunishments(client) {
    const expired = await Punishment.find({ expiresAt: { $lt: Date.now() } });

    if (expired.length > 0) {
        console.log(`[PUNIDOS] Encontradas ${expired.length} punições expiradas. Removendo...`);
        const logChannel = await client.channels.fetch(PUNISHED_LOG_CHANNEL_ID).catch(() => null);
        const simplifiedLogChannel = await client.channels.fetch(BOT_LOG_CHANNEL_ID).catch(() => null);

        for (const punishment of expired) {
            const guild = await client.guilds.fetch(client.guilds.cache.first().id);
            if (!guild) continue;

            const member = await guild.members.fetch(punishment.memberId).catch(() => null);

            if (member && member.roles.cache.has(punishment.roleId)) {
                try {
                    await member.roles.remove(punishment.roleId, 'Punição expirada automaticamente.');
                    console.log(`[PUNIDOS] Cargo de punição ${punishment.roleId} removido de ${member.user.tag}.`);
                    if (logChannel) {
                        const logEmbed = createPunishmentExpiredLogEmbed(punishment);
                        const mention = `||<@${punishment.memberId}>||`;
                        await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
                    }
                    if (simplifiedLogChannel) {
                        const simplifiedLogMessage = createSimplifiedExpiredLogMessage(punishment);
                        await simplifiedLogChannel.send({ content: simplifiedLogMessage }).catch(console.error);
                    }
                } catch (e) {
                    console.error(`[PUNIDOS] Erro ao remover cargo de ${member.user.tag}:`, e);
                }
            } else if (member) {
                console.log(`[PUNIDOS] Membro ${member.user.tag} não possui mais o cargo de punição. Removendo do registro.`);
                if (simplifiedLogChannel) {
                    const simplifiedLogMessage = createSimplifiedExpiredLogMessage(punishment);
                    await simplifiedLogChannel.send({ content: simplifiedLogMessage }).catch(console.error);
                }
            } else {
                console.log(`[PUNIDOS] Membro com ID ${punishment.memberId} não encontrado no servidor. Removendo do registro.`);
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setTitle('<a:positivo:1397953846063398933> Punição Expirada (Membro não encontrado)')
                        .setColor('#00FF00')
                        .setDescription(`A punição de tempo do membro com ID \`${punishment.memberId}\` foi removida automaticamente do registro, pois o membro não foi encontrado no servidor.`)
                        .addFields(
                            { name: 'Motivo:', value: punishment.reason },
                            { name: 'Punição:', value: `<@&${punishment.roleId}>`, inline: true }
                        );
                    await logChannel.send({ embeds: [logEmbed] }).catch(console.error);
                }
                if (simplifiedLogChannel) {
                    const simplifiedLogMessage = createSimplifiedExpiredLogMessage(punishment);
                    await simplifiedLogChannel.send({ content: simplifiedLogMessage }).catch(console.error);
                }
            }
        }
        await Punishment.deleteMany({ _id: { $in: expired.map(p => p._id) } });
        console.log('[PUNIDOS] Limpeza de punições expiradas concluída.');
    }
}

// --- Exportações do Módulo ---
module.exports = (client) => {
    client.once('ready', async () => {
        console.log('[PUNIDOS] Iniciando limpeza e envio do painel de punições...');
        await connectToDatabase();
        await ensurePunishmentMessage(client);

        // Inicia a verificação de punições expiradas
        setInterval(() => checkExpiredPunishments(client), 10 * 60 * 1000); // Roda a cada 10 minutos
        console.log('[PUNIDOS] Verificador de punições expiradas iniciado.');

    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() && interaction.customId && !interaction.customId.startsWith('punish_')) {
            return;
        }

        if (interaction.isButton() && (interaction.customId === 'punish_apply' || interaction.customId === 'punish_remove')) {
            if (!interaction.member.roles.cache.has(RESPONSIBLE_ROLE_ID)) {
                return interaction.reply({
                    content: `<:ban:1403120687329181698> Painel permitido apenas para <@&${RESPONSIBLE_ROLE_ID}>!!!`,
                    ephemeral: true
                });
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('punish_remove_select')) {
            if (!interaction.member.roles.cache.has(RESPONSIBLE_ROLE_ID)) {
                return interaction.reply({
                    content: `<:ban:1403120687329181698> Painel permitido apenas para <@&${RESPONSIBLE_ROLE_ID}>!!!`,
                    ephemeral: true
                });
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'punish_apply') {
                const modal = new ModalBuilder()
                    .setCustomId('punish_apply_modal')
                    .setTitle('Aplicar Punição');

                const qraInput = new TextInputBuilder()
                    .setCustomId('punish_qra')
                    .setLabel('Membro Punido (ID do dc ou Menção)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Ex: 707959058228969485 ou <@707959058228969485>')
                    .setRequired(true);

                const reasonInput = new TextInputBuilder()
                    .setCustomId('punish_reason')
                    .setLabel('Motivo da Punição')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const punishmentTypeInput = new TextInputBuilder()
                    .setCustomId('punish_type')
                    .setLabel('Tipo de Punição:')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Leve | Media | Grave | Exoneração')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(qraInput),
                    new ActionRowBuilder().addComponents(reasonInput),
                    new ActionRowBuilder().addComponents(punishmentTypeInput)
                );

                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'punish_remove') {
                await interaction.deferReply({ ephemeral: true });

                await checkExpiredPunishments(interaction.client);
                const removablePunishments = await Punishment.find({ punishmentType: { $ne: 'exoneração' } });

                if (removablePunishments.length === 0) {
                    await interaction.editReply({ content: 'Não há punições removíveis ativas no momento.' });
                    return;
                }
                
                const rows = [];
                const chunkSize = 25;
                const maxRows = 5;
                const numMenus = Math.min(Math.ceil(removablePunishments.length / chunkSize), maxRows);
                
                for (let i = 0; i < numMenus; i++) {
                    const chunk = removablePunishments.slice(i * chunkSize, (i + 1) * chunkSize);
                    const options = chunk.map((p) => ({
                        label: `${p.memberName} (${PUNISHMENT_TYPES[p.punishmentType]?.name || p.punishmentType})`,
                        description: `Motivo: ${p.reason.slice(0, 50)}...`,
                        value: p._id.toString(),
                    }));
                    
                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`punish_remove_select_${i}`)
                        .setPlaceholder(`Remover Punição (Parte ${i + 1}/${numMenus})`)
                        .addOptions(options);

                    rows.push(new ActionRowBuilder().addComponents(selectMenu));
                }

                // If more than 5 menus are needed, add a button to remove by ID
                if (removablePunishments.length > chunkSize * maxRows) {
                    const removeByIdButton = new ButtonBuilder()
                        .setCustomId('punish_remove_by_id')
                        .setLabel('Remover por ID')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🆔');
                    
                    rows.push(new ActionRowBuilder().addComponents(removeByIdButton));
                    
                    await interaction.editReply({
                        content: `Há mais de ${chunkSize * maxRows} punições ativas. Abaixo estão os ${chunkSize * maxRows} mais recentes. Use o botão "Remover por ID" para as demais, ou o comando \`/punicoes\` para a lista completa.`,
                        components: rows,
                    });
                } else {
                    await interaction.editReply({
                        content: 'Selecione a punição que deseja remover:',
                        components: rows,
                    });
                }

                return;
            }
            
            if (interaction.customId === 'punish_remove_by_id') {
                const modal = new ModalBuilder()
                    .setCustomId('punish_remove_modal')
                    .setTitle('Remover Punição por ID');

                const punishmentIdInput = new TextInputBuilder()
                    .setCustomId('punish_id')
                    .setLabel('ID da Punição')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Cole o ID da punição que você quer remover aqui.')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(punishmentIdInput));
                await interaction.showModal(modal);
                return;
            }
        }
        
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'punish_remove_modal') {
                await interaction.deferReply({ ephemeral: true });

                const punishmentIdToRemove = interaction.fields.getTextInputValue('punish_id');

                const removedPunishment = await Punishment.findByIdAndDelete(punishmentIdToRemove);

                if (!removedPunishment) {
                    await interaction.editReply({ content: '<:Negativo:1403204560058585138> Punição não encontrada ou já removida.' });
                    return;
                }

                const member = await interaction.guild.members.fetch(removedPunishment.memberId).catch(() => null);
                if (member && member.roles.cache.has(removedPunishment.roleId)) {
                    try {
                        await member.roles.remove(removedPunishment.roleId, 'Punição removida manualmente via comando.');
                        await interaction.editReply({ content: `<:Positivo:1403203942573150362> Cargo de punição removido de <@${member.id}>.` });
                    } catch (roleRemoveError) {
                        console.error('Erro ao remover cargo de punição:', roleRemoveError);
                        await interaction.editReply({ content: '<:remover:1403214664946417664> Punição removida do registro, mas houve um erro ao remover o cargo do membro. Verifique as permissões do bot.' });
                    }
                } else if (member) {
                    await interaction.editReply({ content: `<:adicionar:1403214675872579725> Punição removida do registro, mas o membro não possui mais o cargo de punição.` });
                } else {
                    await interaction.editReply({ content: `<:adicionar:1403214675872579725> Punição removida do registro. Membro não encontrado no servidor.` });
                }

                const logChannel = await interaction.client.channels.fetch(PUNISHED_LOG_CHANNEL_ID);
                const simplifiedLogChannel = await interaction.client.channels.fetch(BOT_LOG_CHANNEL_ID);

                if (removedPunishment.logMessageId) {
                    if (logChannel && logChannel.isTextBased()) {
                        try {
                            const logMessage = await logChannel.messages.fetch(removedPunishment.logMessageId);
                            if (logMessage) {
                                const updatedLogEmbed = createPunishmentRemovedLogEmbed(removedPunishment);
                                const mention = `||<@${removedPunishment.memberId}>||`;
                                await logMessage.edit({ embeds: [updatedLogEmbed] });
                            }
                        } catch (logEditError) {
                            console.error('Erro ao editar embed de log da punição removida:', logEditError);
                        }
                    }
                }
                if (simplifiedLogChannel && simplifiedLogChannel.isTextBased()) {
                    const simplifiedLogMessage = createSimplifiedRemovedLogMessage(removedPunishment, interaction.user);
                    await simplifiedLogChannel.send({ content: simplifiedLogMessage }).catch(console.error);
                }
                return;
            }

            if (interaction.customId === 'punish_apply_modal') {
                await interaction.deferReply({ ephemeral: true });

                const qraInputContent = interaction.fields.getTextInputValue('punish_qra');
                const reason = interaction.fields.getTextInputValue('punish_reason');
                const punishmentType = interaction.fields.getTextInputValue('punish_type').toLowerCase();

                const punisher = interaction.user;

                const punishmentInfo = PUNISHMENT_TYPES[punishmentType];
                if (!punishmentInfo) {
                    await interaction.editReply({ content: '<:Negativo:1403204560058585138> Tipo de punição inválido. Use Leve, Media, Grave ou Exoneração.' });
                    return;
                }

                if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    await interaction.editReply({ content: 'Você não tem permissão para aplicar punições.', ephemeral: true });
                    return;
                }

                const memberId = await extractUserId(interaction.guild, qraInputContent);
                if (!memberId) {
                    await interaction.editReply({ content: '<:Negativo:1403204560058585138> Não foi possível encontrar o ID do membro a partir do que foi fornecido. Olha se é um ID válido do Discord ou uma menção.' });
                    return;
                }

                const member = await interaction.guild.members.fetch(memberId).catch(() => null);
                if (!member) {
                    await interaction.editReply({ content: '<:Negativo:1403204560058585138> O membro com o ID fornecido não foi encontrado no servidor.' });
                    return;
                }

                const memberDisplayName = member.displayName || member.user.username;
                let expiresAt = null;
                if (punishmentInfo.days > 0) {
                    expiresAt = Date.now() + (punishmentInfo.days * 24 * 60 * 60 * 1000);
                }

                const newPunishment = await Punishment.create({
                    memberId: member.id,
                    memberName: memberDisplayName,
                    punishmentType: punishmentType,
                    roleId: punishmentInfo.roleId,
                    reason: reason,
                    punisherId: punisher.id,
                    punishedAt: Date.now(),
                    expiresAt: expiresAt,
                    guildId: interaction.guild.id,
                    logChannelId: PUNISHED_LOG_CHANNEL_ID,
                    highestRole: getHighestRole(member)
                });

                const logChannel = await interaction.client.channels.fetch(PUNISHED_LOG_CHANNEL_ID);
                const simplifiedLogChannel = await interaction.client.channels.fetch(BOT_LOG_CHANNEL_ID);

                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = createPunishmentLogEmbed(newPunishment, member);
                    try {
                        const mention = `||<@${member.id}>||`;
                        const sentLogMessage = await logChannel.send({ embeds: [logEmbed] });
                        newPunishment.logMessageId = sentLogMessage.id;
                        await newPunishment.save();

                        if (simplifiedLogChannel && simplifiedLogChannel.isTextBased()) {
                            const simplifiedLogMessage = createSimplifiedAppliedLogMessage(newPunishment, punisher);
                            await simplifiedLogChannel.send({ content: simplifiedLogMessage }).catch(console.error);
                        }

                    } catch (logError) {
                        console.error('Erro ao enviar embed de log para o canal de punições:', logError);
                    }
                } else {
                    console.warn(`Canal de log de punições (ID: ${PUNISHED_LOG_CHANNEL_ID}) não encontrado ou não é de texto.`);
                }

                try {
                    const allPunishmentRoleIds = Object.values(ROLES);
                    await member.roles.remove(allPunishmentRoleIds, 'Removendo cargos de punição antigos para aplicar novo.');
                    await member.roles.add(punishmentInfo.roleId, `Punição: ${punishmentInfo.name}`);

                    if (punishmentType === 'exoneração') {
                        if (!member.user.bot) {
                            const rolesToRemove = member.roles.cache.filter(role =>
                                role.id !== interaction.guild.id &&
                                !allPunishmentRoleIds.includes(role.id)
                            );
                            await member.roles.remove(rolesToRemove, 'Exoneração: Removendo todos os cargos');
                        }
                    }

                    await interaction.editReply({ content: `<:Positivo:1403203942573150362> Punição de **${punishmentInfo.name}** aplicada a <@${member.id}>. Motivo: ${reason}` });
                } catch (roleError) {
                    console.error('Erro ao aplicar/remover cargos:', roleError);
                    await interaction.editReply({ content: '<a:c_warningrgbFXP:1403098424689033246> Punição aplicada, mas houve um erro chama o Kaique!!!' });
                }
                return;
            }
        }
        
        if (interaction.isStringSelectMenu()) {
            await interaction.deferUpdate();

            if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageRoles)) {
                await interaction.followUp({ content: 'Você não tem permissão para remover punições.', ephemeral: true });
                return;
            }

            const punishmentIdToRemove = interaction.values[0];
            const removedPunishment = await Punishment.findByIdAndDelete(punishmentIdToRemove);

            if (!removedPunishment) {
                await interaction.followUp({ content: '<:Negativo:1403204560058585138> Punição não encontrada ou já removida.', ephemeral: true });
                return;
            }

            const member = await interaction.guild.members.fetch(removedPunishment.memberId).catch(() => null);
            if (member && member.roles.cache.has(removedPunishment.roleId)) {
                try {
                    await member.roles.remove(removedPunishment.roleId, 'Punição removida manualmente.');
                    await interaction.followUp({ content: `<:Positivo:1403203942573150362> Cargo de punição removido de <@${member.id}>.`, ephemeral: true });
                } catch (roleRemoveError) {
                    console.error('Erro ao remover cargo de punição:', roleRemoveError);
                    await interaction.followUp({ content: '<:remover:1403214664946417664> Punição removida do registro, mas houve um erro ao remover o cargo do membro. Verifique as permissões do bot.', ephemeral: true });
                }
            } else if (member) {
                await interaction.followUp({ content: `<:adicionar:1403214675872579725> Punição removida do registro, mas o membro não possui mais o cargo de punição.`, ephemeral: true });
            } else {
                await interaction.followUp({ content: `<:adicionar:1403214675872579725> Punição removida do registro. Membro não encontrado no servidor.`, ephemeral: true });
            }

            const logChannel = await interaction.client.channels.fetch(PUNISHED_LOG_CHANNEL_ID);
            const simplifiedLogChannel = await interaction.client.channels.fetch(BOT_LOG_CHANNEL_ID);

            if (removedPunishment.logMessageId) {
                if (logChannel && logChannel.isTextBased()) {
                    try {
                        const logMessage = await logChannel.messages.fetch(removedPunishment.logMessageId);
                        if (logMessage) {
                            const updatedLogEmbed = createPunishmentRemovedLogEmbed(removedPunishment);
                            const mention = `||<@${removedPunishment.memberId}>||`;
                            await logMessage.edit({ embeds: [updatedLogEmbed] });
                        }
                    } catch (logEditError) {
                        console.error('Erro ao editar embed de log da punição removida:', logEditError);
                    }
                }
            }
            if (simplifiedLogChannel && simplifiedLogChannel.isTextBased()) {
                const simplifiedLogMessage = createSimplifiedRemovedLogMessage(removedPunishment, interaction.user);
                await simplifiedLogChannel.send({ content: simplifiedLogMessage }).catch(console.error);
            }
            return;
        }
    });
};
