const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
const path = require('path');
const connectToDatabase = require('../database');
const Blacklist = require('../models/Blacklist');

// --- Configurações da Blacklist ---
const BLACKLIST_CHANNEL_ID = '1403592831951573072';
const LOG_CHANNEL_ID = '1403603952234397728';
const BLACKLIST_MESSAGE_TITLE = '<a:banned:1369644837930008707> LISTA DA BLACKLIST DA RÚSSIA';
const BLACKLIST_MESSAGE_DESCRIPTION = '<a:setabranca:1403599822207979562> Os membros da lista abaixo estão proibidos de adentrar na Organização sem permissão concedida pela Alta Cúpula';
const BLACKLIST_MESSAGE_IMAGE = 'https://cdn.discordapp.com/attachments/1242690408782495757/1403247489523650690/BLACKLIST.png?ex=6896db90&is=68958a10&hm=24e61cc5854db1b7a30db7d8eef03a7b725b0f15b0ade765474aed6e9eceaf4a&';
const BLACKLIST_ROLE_ID = '1403450453978513508';

// --- Funções de Criação de Componentes UI ---
function createBlacklistButtons() {
    const addButton = new ButtonBuilder()
        .setCustomId('blacklist_add')
        .setLabel('Adicionar Blacklist')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('<:ban:1403120687329181698>');
    const removeButton = new ButtonBuilder()
        .setCustomId('blacklist_remove')
        .setLabel('Remover Blacklist')
        .setStyle(ButtonStyle.Success)
        .setEmoji('<:Positivo:1403203942573150362>');
    return new ActionRowBuilder().addComponents(addButton, removeButton);
}

// --- Funções de Criação de Embeds ---
async function createBlacklistEmbed() {
    let blacklist = [];
    try {
        await connectToDatabase();
        blacklist = await Blacklist.find({});
    } catch (e) {
        console.error('Erro ao carregar a blacklist do banco de dados:', e);
    }

    const embed = new EmbedBuilder()
        .setTitle(BLACKLIST_MESSAGE_TITLE)
        .setColor(0x2b2d31)
        .setDescription(
            `${BLACKLIST_MESSAGE_DESCRIPTION}\n\n` +
            `<:ponto:1404150420883898510> **Membros (${blacklist.length}):**\n\n` +
            (blacklist.length > 0
                ? blacklist
                    .map((membro) => {
                        return `**<:ponto:1404150420883898510> Nome:** \`${membro.memberName}\`\n` +
                               `**<:ponto:1404150420883898510> ID:** \`${membro.memberId}\`\n` +
                               `**<:ponto:1404150420883898510> Motivo:** \`${membro.reason || 'Não fornecido'}\`\n`;
                    })
                    .join('\n')
                : '`A lista de blacklist está vazia.`')
        )
        .setImage(BLACKLIST_MESSAGE_IMAGE);

    return embed;
}

async function updateBlacklistPanel(client) {
    const channel = client.channels.cache.get(BLACKLIST_CHANNEL_ID);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages) return;

    const panelMessage = messages.find(msg =>
        msg.author.id === client.user.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0].title === BLACKLIST_MESSAGE_TITLE
    );

    const updatedEmbed = await createBlacklistEmbed();
    const buttons = createBlacklistButtons();

    if (panelMessage) {
        await panelMessage.edit({ embeds: [updatedEmbed], components: [buttons] });
    }
}

async function handleAddBlacklistModal(interaction) {
    if (!interaction.member.roles.cache.has(BLACKLIST_ROLE_ID)) {
        return interaction.reply({
            content: 'Você não tem permissão para usar este botão.',
            flags: 64,
        });
    }

    const memberId = interaction.fields.getTextInputValue('member_id_input');
    const memberName = interaction.fields.getTextInputValue('member_name_input');
    const reason = interaction.fields.getTextInputValue('reason_input');

    try {
        await connectToDatabase();
        const existingEntry = await Blacklist.findOne({ memberId });

        if (existingEntry) {
            return interaction.reply({
                content: `O membro com ID \`${memberId}\` já está na blacklist.`,
                flags: 64,
            });
        }

        const newEntry = await Blacklist.create({
            memberId,
            memberName,
            reason,
            moderadorId: interaction.user.id,
            dataEntrada: new Date(),
        });

        await updateBlacklistPanel(interaction.client);
        
        // Log de adição em texto simples
        const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            const motivoText = newEntry.reason ? `Motivo: \`${newEntry.reason}\`` : 'Não foi fornecido um motivo.';
            const logMessage = `<:SlashCommands:1402754768702672946> | O Membro \`${newEntry.memberName} - ID: ${newEntry.memberId}\` foi adicionado à blacklist por <@${interaction.user.id}>. ${motivoText}`;
            await logChannel.send(logMessage);
        }

        await interaction.reply({
            content: `O Membro \`${newEntry.memberName}\` \`${newEntry.memberId}\` foi adicionado a blacklist com sucesso!`,
            flags: 64,
        });
    } catch (e) {
        console.error('Erro ao adicionar membro à blacklist:', e);
        return interaction.reply({
            content: 'Ocorreu um erro ao tentar adicionar o membro à blacklist.',
            flags: 64,
        });
    }
}

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        // --- Manipulador de Botões ---
        if (interaction.isButton() && interaction.customId.startsWith('blacklist_')) {
            // Verifica permissões
            if (!interaction.member.roles.cache.has(BLACKLIST_ROLE_ID)) {
                return interaction.reply({
                    content: 'Você não tem permissão para usar este botão.',
                    flags: 64,
                });
            }
    
            if (interaction.customId === 'blacklist_add') {
                const modal = new ModalBuilder()
                    .setCustomId('blacklist_add_modal')
                    .setTitle('Adicionar à Blacklist');
    
                const memberIdInput = new TextInputBuilder()
                    .setCustomId('member_id_input')
                    .setLabel('ID do Membro')
                    .setPlaceholder('Digite o ID do membro')
                    .setStyle(TextInputStyle.Short);
    
                const memberNameInput = new TextInputBuilder()
                    .setCustomId('member_name_input')
                    .setLabel('Nome do Membro')
                    .setPlaceholder('Digite o nome do membro')
                    .setStyle(TextInputStyle.Short);
    
                const reasonInput = new TextInputBuilder()
                    .setCustomId('reason_input')
                    .setLabel('Motivo da Blacklist (Opcional)')
                    .setPlaceholder('Digite o motivo da inclusão na blacklist')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Paragraph);
    
                modal.addComponents(
                    new ActionRowBuilder().addComponents(memberIdInput),
                    new ActionRowBuilder().addComponents(memberNameInput),
                    new ActionRowBuilder().addComponents(reasonInput)
                );
                
                await interaction.showModal(modal);
            } else if (interaction.customId === 'blacklist_remove') {
                await interaction.deferReply({ flags: 64 });
                await connectToDatabase();
                const blacklist = await Blacklist.find({});
    
                if (blacklist.length === 0) {
                    return interaction.editReply({
                        content: 'A lista de blacklist está vazia. Não há membros para remover.',
                    });
                }
    
                const options = blacklist.map(membro =>
                    new StringSelectMenuOptionBuilder()
                    .setLabel(`${membro.memberName} | ID: ${membro.memberId}`)
                    .setValue(membro.memberId)
                );
                
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('blacklist_remove_select')
                    .setPlaceholder('Selecione um membro para remover da blacklist')
                    .addOptions(options);
    
                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                await interaction.editReply({
                    content: 'Selecione o membro que deseja remover da blacklist:',
                    components: [row],
                });
            }
        }
        
        // --- Manipulador de Modal Submit ---
        if (interaction.isModalSubmit() && interaction.customId === 'blacklist_add_modal') {
            await handleAddBlacklistModal(interaction);
        }

        // --- Manipulador de Select Menu ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'blacklist_remove_select') {
            // Verifica permissões
            if (!interaction.member.roles.cache.has(BLACKLIST_ROLE_ID)) {
                return interaction.reply({
                    content: 'Você não tem permissão para usar este menu.',
                    flags: 64,
                });
            }
            
            await interaction.deferUpdate();
            const memberIdToRemove = interaction.values[0];
            const removedMember = await Blacklist.findOne({ memberId: memberIdToRemove });
    
            try {
                await connectToDatabase();
                const removed = await Blacklist.deleteOne({ memberId: memberIdToRemove });
    
                if (removed.deletedCount > 0) {
                    
                    await updateBlacklistPanel(interaction.client);
                    
                    // Log de remoção para o canal de logs
                    const logChannel = interaction.client.channels.cache.get(LOG_CHANNEL_ID);
                    if (logChannel) {
                        const logMessage = `<:SlashCommands:1402754768702672946> | O Membro \`${removedMember.memberName} - ID: ${memberIdToRemove}\` foi removido da blacklist por <@${interaction.user.id}>`;
                        await logChannel.send(logMessage);
                    }
    
                    await interaction.editReply({
                        content: `O membro \`${removedMember.memberName}\` foi removido da blacklist com sucesso!`,
                        components: [], // Remove o menu de seleção após a remoção
                    });
                } else {
                    await interaction.editReply({
                        content: `Não foi encontrado nenhum membro com ID \`${memberIdToRemove}\` na blacklist.`,
                        components: [],
                    });
                }
            } catch (e) {
                console.error('Erro ao remover membro da blacklist:', e);
                await interaction.editReply({
                    content: 'Ocorreu um erro ao tentar remover o membro da blacklist.',
                });
            }
        }
    });

    client.on('ready', async () => {
        const channel = client.channels.cache.get(BLACKLIST_CHANNEL_ID);
        if (!channel) {
            console.error('[BLACKLIST] Canal da blacklist não encontrado. Verifique a configuração de ID.');
            return;
        }

        const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!messages) {
            console.error('[BLACKLIST] Não foi possível buscar mensagens no canal da blacklist.');
            return;
        }

        const panelMessage = messages.find(msg =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title === BLACKLIST_MESSAGE_TITLE
        );

        const embed = await createBlacklistEmbed();
        const buttons = createBlacklistButtons();

        if (panelMessage) {
            console.log('[BLACKLIST] Painel existente encontrado. Atualizando...');
            await panelMessage.edit({ embeds: [embed], components: [buttons] });
        } else {
            console.log('[BLACKLIST] Painel não encontrado. Criando um novo...');
            await channel.send({ embeds: [embed], components: [buttons] });
        }
    });

    return {};
};