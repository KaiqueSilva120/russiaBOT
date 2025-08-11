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
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Configurações da Blacklist ---
const BLACKLIST_CHANNEL_ID = '1403592831951573072';
const BLACKLIST_MESSAGE_TITLE = '<a:banned:1369644837930008707> LISTA DA BLACKLIST DA RÚSSIA';
const BLACKLIST_MESSAGE_DESCRIPTION = '<a:seta_gugu1:1398025125537775639> Os membros da lista abaixo estão proibidos de adentrar na Organização sem permissão concedida pela Alta Cúpula';
const BLACKLIST_MESSAGE_IMAGE = 'https://cdn.discordapp.com/attachments/1242690408782495757/1403247489523650690/BLACKLIST.png?ex=6896db90&is=68958a10&hm=24e61cc5854db1b7a30db7d8eef03a7b725b0f15b0ade765474aed6e9eceaf4a&';

// O ID do cargo responsável pela blacklist (corrigido para usar apenas o ID)
const BLACKLIST_ROLE_ID = '1403450453978513508';

// O caminho para o arquivo JSON está correto, na pasta 'banco'
const BLACKLIST_DB_FILE = path.join(__dirname, '../banco/blacklist.json');

// --- Funções de Manipulação do Banco de Dados ---
/**
 * Carrega a blacklist do arquivo JSON.
 * @returns {Array} A lista de membros na blacklist.
 */
function loadBlacklist() {
    try {
        if (!fs.existsSync(BLACKLIST_DB_FILE)) {
            fs.mkdirSync(path.dirname(BLACKLIST_DB_FILE), { recursive: true });
            fs.writeFileSync(BLACKLIST_DB_FILE, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(BLACKLIST_DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Erro ao carregar a blacklist:', e);
        return [];
    }
}

/**
 * Salva a blacklist no arquivo JSON.
 * @param {Array} blacklist - A lista de membros a ser salva.
 */
function saveBlacklist(blacklist) {
    try {
        fs.writeFileSync(BLACKLIST_DB_FILE, JSON.stringify(blacklist, null, 2));
    } catch (e) {
        console.error('Erro ao salvar a blacklist:', e);
    }
}

// --- Funções de Criação de Componentes UI ---
/**
 * Cria os botões para adicionar e remover membros da blacklist.
 * @returns {ActionRowBuilder} A linha de componentes com os botões.
 */
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

/**
 * Cria a embed da blacklist com a lista de membros.
 * @param {Array} blacklistArray - A lista de membros na blacklist.
 * @returns {EmbedBuilder} A embed da blacklist.
 */
function createBlacklistEmbed(blacklistArray) {
    const embed = new EmbedBuilder()
        .setTitle(BLACKLIST_MESSAGE_TITLE)
        .setDescription(BLACKLIST_MESSAGE_DESCRIPTION)
        .setImage(BLACKLIST_MESSAGE_IMAGE)
        .setColor('#FF0000')
        .setTimestamp();

    if (blacklistArray.length > 0) {
        const listText = blacklistArray.map((member, index) => {
            return `\`\`${index + 1}.\`\` **Nome:** ${member.name} | **ID:** ${member.id}${member.reason ? ` | **Motivo:** ${member.reason}` : ''}`;
        }).join('\n');
        
        embed.addFields({ name: 'Membros Atualmente na Blacklist:', value: listText.slice(0, 1024) });
    } else {
        embed.addFields({ name: 'Membros Atualmente na Blacklist:', value: 'Nenhum membro na blacklist no momento.' });
    }

    return embed;
}

// --- Função para Manter a Mensagem Fixa ---
/**
 * Garante que a mensagem da blacklist esteja presente e atualizada no canal.
 * @param {Client} client - A instância do cliente Discord.
 * @param {boolean} forceUpdate - Se true, força a edição da mensagem existente.
 */
async function maintainBlacklistMessage(client, forceUpdate = false) {
    const blacklistChannel = await client.channels.fetch(BLACKLIST_CHANNEL_ID);
    if (!blacklistChannel || !blacklistChannel.isTextBased()) {
        console.error(`Canal da blacklist (ID: ${BLACKLIST_CHANNEL_ID}) não encontrado ou não é um canal de texto.`);
        return;
    }

    const currentBlacklist = loadBlacklist();
    const newEmbed = createBlacklistEmbed(currentBlacklist);
    const buttonsRow = createBlacklistButtons();

    try {
        const pinnedMessages = await blacklistChannel.messages.fetchPinned();
        const existingPanel = pinnedMessages.find(msg =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes('BLACKLIST')
        );

        if (existingPanel) {
            if (forceUpdate) {
                await existingPanel.edit({ embeds: [newEmbed], components: [buttonsRow] });
                console.log('[BLACKLIST] Painel existente atualizado forçadamente.');
            } else {
                console.log('[BLACKLIST] Painel existente encontrado. Nenhuma atualização automática necessária.');
            }
            return;
        }

        console.log('[BLACKLIST] Nenhum painel encontrado. Criando novo...');
        const sentMessage = await blacklistChannel.send({ embeds: [newEmbed], components: [buttonsRow] });
        await sentMessage.pin('Mensagem principal do sistema de blacklist.');
        console.log('[BLACKLIST] Novo painel de blacklist enviado e fixado.');

    } catch (error) {
        console.error('Erro ao manter a mensagem da blacklist fixa:', error);
    }
}

// --- Exportação do Módulo como uma única função ---
module.exports = (client) => {
    client.blacklist = loadBlacklist();
    client.blacklistMessageId = null;

    client.on('ready', async () => {
        console.log('Verificando mensagem da blacklist...');
        await maintainBlacklistMessage(client, false);
    });

    client.on('interactionCreate', async (interaction) => {
        // Manipulador para botões de blacklist
        if (interaction.isButton() && ['blacklist_add', 'blacklist_remove'].includes(interaction.customId)) {
            // **CORREÇÃO: O deferReply foi removido daqui para o botão de adicionar
            // e mantido para o de remover, já que a ação do modal já é uma resposta.

            if (interaction.member && !interaction.member.roles.cache.has(BLACKLIST_ROLE_ID)) {
                return interaction.reply({ content: `Somente <@&${BLACKLIST_ROLE_ID}> podem mexer na Blacklist.`, ephemeral: true });
            }

            if (interaction.customId === 'blacklist_add') {
                const modal = new ModalBuilder()
                    .setCustomId('blacklist_add_modal')
                    .setTitle('Adicionar Membro à Blacklist');

                const nameInput = new TextInputBuilder()
                    .setCustomId('blacklist_name')
                    .setLabel('Nome do Membro')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const idInput = new TextInputBuilder()
                    .setCustomId('blacklist_id')
                    .setLabel('RG do Membro')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const reasonInput = new TextInputBuilder()
                    .setCustomId('blacklist_reason')
                    .setLabel('Motivo (Opcional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(idInput),
                    new ActionRowBuilder().addComponents(reasonInput)
                );
                
                await interaction.showModal(modal);

            } else if (interaction.customId === 'blacklist_remove') {

                await interaction.deferReply({ ephemeral: true });

                const currentBlacklist = loadBlacklist();
                if (currentBlacklist.length === 0) {
                    return interaction.editReply({ content: 'A blacklist está vazia. Não há membros para remover.' });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('blacklist_remove_select')
                    .setPlaceholder('Selecione um membro para remover')
                    .addOptions(
                        currentBlacklist.map((member) => ({
                            label: member.name,
                            description: `ID: ${member.id}${member.reason ? ` | Motivo: ${member.reason}` : ''}`,
                            value: member.id,
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);
                await interaction.editReply({
                    content: 'Selecione o membro que deseja remover da blacklist:',
                    components: [row]
                });
            }
        }

        // Manipulador para o modal de adicionar blacklist
        if (interaction.isModalSubmit() && interaction.customId === 'blacklist_add_modal') {

             await interaction.deferReply({ ephemeral: true });
            
             if (interaction.member && !interaction.member.roles.cache.has(BLACKLIST_ROLE_ID)) {
                return interaction.editReply({ content: `Somente <@&${BLACKLIST_ROLE_ID}> podem mexer na Blacklist.` });
            }

            const name = interaction.fields.getTextInputValue('blacklist_name');
            const id = interaction.fields.getTextInputValue('blacklist_id');
            const reason = interaction.fields.getTextInputValue('blacklist_reason');

            if (!/^\d+$/.test(id)) {
                return interaction.editReply({ content: '<:Negativo:1403204560058585138> O ID do membro deve ser um número válido.' });
            }

            let currentBlacklist = loadBlacklist();
            if (currentBlacklist.some(member => member.id === id)) {
                return interaction.editReply({ content: `<:Negativo:1403204560058585138> O membro com ID \`${id}\` já está na blacklist.` });
            }

            currentBlacklist.push({ name, id, reason });
            saveBlacklist(currentBlacklist);
            await interaction.editReply({ content: `<:Positivo:1403203942573150362> Membro **${name}** (ID: \`${id}\`) adicionado à blacklist.` });

            await maintainBlacklistMessage(client, true);
        }

        // Manipulador para o menu de seleção de remoção
        if (interaction.isStringSelectMenu() && interaction.customId === 'blacklist_remove_select') {

             await interaction.deferReply({ ephemeral: true });

             if (interaction.member && !interaction.member.roles.cache.has(BLACKLIST_ROLE_ID)) {
                return interaction.editReply({ content: `Somente <@&${BLACKLIST_ROLE_ID}> podem mexer na Blacklist.` });
            }
            
            const memberIdToRemove = interaction.values[0];

            let currentBlacklist = loadBlacklist();
            const initialLength = currentBlacklist.length;
            currentBlacklist = currentBlacklist.filter(member => member.id !== memberIdToRemove);

            if (currentBlacklist.length < initialLength) {
                saveBlacklist(currentBlacklist);
                await interaction.editReply({ content: `<:Positivo:1403203942573150362> Membro com ID \`${memberIdToRemove}\` removido da blacklist.`, components: [] });

                await maintainBlacklistMessage(client, true);
            } else {
                await interaction.editReply({ content: '<:Negativo:1403204560058585138> Membro não encontrado na blacklist.', components: [] });
            }
        }
    });
};