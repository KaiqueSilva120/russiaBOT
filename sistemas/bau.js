const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, InteractionType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');

module.exports = (client) => {
    // Caminhos dos arquivos JSON
    const dataPath = path.join(__dirname, '../data');
    const bauFilePath = path.join(dataPath, 'bau.json');
    const movimentacoesFilePath = path.join(dataPath, 'movimentacoes.json');
    const itensValidosFilePath = path.join(dataPath, 'itensValidos.json');

    // IDs dos canais
    const BAU_CHANNEL_ID = '1403592583539720262';
    const LOGS_CHANNEL_ID = '1403592668168065145';
    const BOT_LOG_CHANNEL_ID = '1403603952234397728';

    // ID da role de Responsável pelo Baú
    const RESPONSAVEL_BAU_ROLE_ID = '1354892378757922877';

    // Funções para ler e salvar arquivos JSON
    function readJSON(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
                
                // Nova estrutura de dados conforme solicitado
                const initialData = filePath === itensValidosFilePath ? {
                    "armas": [
                        { "name": "ak 47", "aliases": ["ak", "ak-47", "ak47"] },
                        { "name": "five seven", "aliases": ["five-seven", "five", "pistola"] },
                        { "name": "uzi", "aliases": ["usi", "mini uzi"] },
                        { "name": "pdw", "aliases": ["Pdw"] },
                        { "name": "munição 762", "aliases": ["muni", "municao", "municao 762", "muniçao acao"] },
                        { "name": "munição 380", "aliases": ["muni 380", "municao 380"] }
                    ],
                    "materiais": [
                        { "name": "ferro", "aliases": ["lingote de ferro", "ferros", "lingote ferros"] }
                    ],
                    "itens": [
                        { "name": "celular", "aliases": ["cell", "cel"] },
                        { "name": "radio", "aliases": ["radinho"] },
                        { "name": "capuz", "aliases": ["capus"] },
                        { "name": "chave amarela", "aliases": ["chave amarela (lojinha)"] },
                        { "name": "chave verde", "aliases": [] },
                        { "name": "chave vermelha", "aliases": [] },
                        { "name": "ticket corrida", "aliases": [] },
                        { "name": "kit de reparo", "aliases": ["kit reparo"] },
                        { "name": "colete", "aliases": ["coletes"] },
                        { "name": "c4", "aliases": [] }
                    ],
                    "comida": [
                        { "name": "balde de frango", "aliases": ["frango", "baldes de frango", "baude de frango", "baude frango"] },
                        { "name": "refrigerante", "aliases": ["refri"] },
                        { "name": "soda", "aliases": ["sodas"] },
                        { "name": "batata frita", "aliases": ["batatinhas fritas"] },
                        { "name": "cachorro quente", "aliases": ["hot dog"] },
                        { "name": "água", "aliases": ["agua", "Água"] }
                    ]
                } : (filePath === movimentacoesFilePath ? [] : {});
                fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf8');
                return initialData;
            }
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (error) {
            console.error(`Erro ao ler o arquivo JSON ${filePath}:`, error);
            return filePath === movimentacoesFilePath ? [] : {};
        }
    }

    function saveJSON(filePath, data) {
        try {
            if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error) {
            console.error(`Erro ao salvar o arquivo JSON ${filePath}:`, error);
        }
    }
    
    // Função para encontrar o nome principal do item a partir de um alias
    function findMainItemName(itemName, itensValidos) {
        for (const categoria in itensValidos) {
            for (const item of itensValidos[categoria]) {
                if (item.name === itemName || item.aliases.includes(itemName)) {
                    return item.name;
                }
            }
        }
        return null;
    }

    // Funções para registro de movimentação de um único item (usado internamente)
    async function registerSingleMovement(interaction, rg, itemName, quantity, actionType) {
        const itensValidos = readJSON(itensValidosFilePath);
        const mainItemName = findMainItemName(itemName, itensValidos);

        if (!mainItemName) {
            // Lógica de sugestão de item, se não houver alias direto
            const allItems = Object.values(itensValidos).flatMap(list => list.map(item => item.name));
            const allAliases = Object.values(itensValidos).flatMap(list => list.flatMap(item => item.aliases));
            const searchableItems = [...allItems, ...allAliases];

            const matches = stringSimilarity.findBestMatch(itemName, searchableItems);
            const bestMatch = matches.bestMatch;

            if (bestMatch.rating > 0.6) {
                const suggestedMainName = findMainItemName(bestMatch.target, itensValidos);
                return interaction.reply({ content: `Item não encontrado! Você quis dizer '${suggestedMainName}'?`, flags: InteractionResponseFlags.Ephemeral });
            } else {
                return interaction.reply({ content: `Item não encontrado! O item '${itemName}' não foi encontrado na lista de itens válidos, se vc acha que deveria estar na lista, peço que abra um ticket e nos informe.`, flags: InteractionResponseFlags.Ephemeral });
            }
        }

        const bauData = readJSON(bauFilePath);
        const movimentacoes = readJSON(movimentacoesFilePath);
        
        if (!bauData[mainItemName]) {
            bauData[mainItemName] = { added: 0, removed: 0 };
        }

        if (actionType === 'adicionou') {
            bauData[mainItemName].added = (bauData[mainItemName].added || 0) + quantity;
        } else {
            bauData[mainItemName].removed = (bauData[mainItemName].removed || 0) + quantity;
        }
        
        saveJSON(bauFilePath, bauData);

        const logEntry = {
            userId: interaction.user.id,
            username: interaction.user.username,
            rg: rg,
            item: mainItemName,
            quantity: quantity,
            actionType: actionType,
            timestamp: new Date().toISOString()
        };
        movimentacoes.push(logEntry);
        saveJSON(movimentacoesFilePath, movimentacoes);

        const logChannel = client.channels.cache.get(LOGS_CHANNEL_ID);
        if (logChannel) {
            const embedColor = actionType === 'adicionou' ? 0x00ff00 : 0xff0000;
            const actionDescription = actionType === 'adicionou' ? `Quantidade Adicionada: **${quantity}**` : `Quantidade Removida: **${quantity}**`;
            const logEmbed = new EmbedBuilder()
                .setTitle(`📦 Movimentação no Baú - ${actionType.toUpperCase()}`)
                .setDescription(`> Membro: <@${interaction.user.id}>\n`
                              + `> RG: **${rg}**\n`
                              + `> Item: **${mainItemName}**\n`
                              + `> ${actionDescription}\n`
                              + `> Data: **${new Date().toLocaleString('pt-BR')}**`)
                .setColor(embedColor)
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ 
                    text: 'Gerenciamento Baú - Rússia', 
                    icon_url: 'https://cdn.discordapp.com/attachments/1402839271496486943/1403109913890131978/Flag_of_Russia.png?ex=68965b6f&is=689509ef&hm=09d501e8bbb73a9a34275079c050bd6bc01d4a072ca78bdec09a4152e3ca5bc8&' 
                });
            logChannel.send({ embeds: [logEmbed] });
        }
        await interaction.reply({ content: `<:Positivo:1403203942573150362> Sucesso! Você ${actionType} ${quantity}x **${mainItemName}** do baú.`, flags: InteractionResponseFlags.Ephemeral });
    }

    // Comandos Slash
    const commands = [
        {
            data: new SlashCommandBuilder()
                .setName('bau')
                .setDescription('Exibe o relatório geral do baú.'),
            async execute(interaction) {
                const bauData = readJSON(bauFilePath);
                const itensValidos = readJSON(itensValidosFilePath);
                
                const embed = new EmbedBuilder()
                    .setTitle('📦 Relatório Geral do Baú')
                    .setColor(0x0099ff)
                    .setImage('https://cdn.discordapp.com/attachments/1242690408782495757/1403107191510274129/image.png?ex=689658e6&is=68950766&hm=4e1bcefec2c9b135066a093cf1244b7ace748baa0f1d57d2e6f6835fc1c1765b&')
                    .setThumbnail(interaction.guild.iconURL());

                let hasItems = false;
                
                const categoryNames = {
                    armas: 'Armas/Munições',
                    materiais: 'Materiais/Equipamentos',
                    itens: 'Diversos',
                    comida: 'Comida/Bebida'
                };

                for (const categoriaKey in itensValidos) {
                    let categoriaItems = '';
                    for (const item of itensValidos[categoriaKey]) {
                        const mainItemName = item.name;
                        if (bauData[mainItemName]) {
                            hasItems = true;
                            const { added = 0, removed = 0 } = bauData[mainItemName];
                            const saldo = added - removed;
                            const resumoEmoji = saldo >= 0 ? '<a:positivo:1402749751056797707>' : '<a:negativo:1402749793553350806>';
                            
                            categoriaItems += `> **${mainItemName.toUpperCase()}**\n`
                                            + `> <:adicionar:1403214675872579725> **Adicionados:** ${added}\n`
                                            + `> <:remover:1403214664946417664> **Removidos:** ${removed}\n`
                                            + `> ${resumoEmoji} **Saldo:** ${saldo}\n\n`;
                        }
                    }
                    if (categoriaItems) {
                        embed.addFields({ name: `**${categoryNames[categoriaKey]}**`, value: categoriaItems, inline: false });
                    }
                }
                
                if (!hasItems) {
                    embed.setDescription(':mailbox:  Baú limpo!\n\n- Nenhum item registrado por enquanto.');
                }

                await interaction.reply({ embeds: [embed] });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('historicobau')
                .setDescription('Exibe o histórico de movimentações de um usuário.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('O usuário para ver o histórico.')
                        .setRequired(true)),
            async execute(interaction) {
                const user = interaction.options.getUser('usuario');
                const member = interaction.guild.members.cache.get(user.id);
                const movimentacoes = readJSON(movimentacoesFilePath);
                const itensValidos = readJSON(itensValidosFilePath);
                
                const userHistory = movimentacoes.filter(mov => mov.userId === user.id);

                if (userHistory.length === 0) {
                    return interaction.reply({ content: `O usuário ${user.username} não tem movimentações registradas.`, flags: InteractionResponseFlags.Ephemeral });
                }

                // Extrai nome e RG do nome de exibição (nick) do usuário
                let nomeCompleto = 'Não Encontrado';
                let rg = 'Não Encontrado';
                const displayName = member.displayName;
                const match = displayName.match(/「.*?」(.+)「(\d+)」/);
                if (match && match[1] && match[2]) {
                    nomeCompleto = match[1].trim();
                    rg = match[2];
                }

                const embed = new EmbedBuilder()
                    .setTitle(`<a:lupa:1389604951746941159> Histórico de Movimentações de ${nomeCompleto}`)
                    .setDescription(`Aqui estão todas as entradas e saídas registradas automaticamente no sistema de baú por este membro.
> Membro: <@${user.id}>
> Nome: ${nomeCompleto}
> RG: ${rg}`)
                    .setColor(0x0099ff)
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({ 
                        text: 'Gerenciamento Baú - Rússia',
                        icon_url: 'https://cdn.discordapp.com/attachments/1402839271496486943/1403109913890131978/Flag_of_Russia.png?ex=68965b6f&is=689509ef&hm=09d501e8bbb73a9a34275079c050bd6bc01d4a072ca78bdec09a4152e3ca5bc8&' 
                    });

                const summary = userHistory.reduce((acc, mov) => {
                    const mainItemName = findMainItemName(mov.item, itensValidos);
                    if (mainItemName) {
                        const category = Object.keys(itensValidos).find(key => 
                            itensValidos[key].some(item => item.name === mainItemName)
                        );
                        if (!acc[category]) {
                            acc[category] = {};
                        }
                        if (!acc[category][mainItemName]) {
                            acc[category][mainItemName] = { added: 0, removed: 0 };
                        }
                        if (mov.actionType === 'adicionou') {
                            acc[category][mainItemName].added += mov.quantity;
                        } else {
                            acc[category][mainItemName].removed += mov.quantity;
                        }
                    }
                    return acc;
                }, {});

                const categoryNames = {
                    armas: 'Armas/Munições',
                    materiais: 'Materiais/Equipamentos',
                    itens: 'Diversos',
                    comida: 'Comida/Bebida'
                };

                for (const categoriaKey in summary) {
                    let categoriaItems = '';
                    for (const item in summary[categoriaKey]) {
                        const { added, removed } = summary[categoriaKey][item];
                        categoriaItems += `> **${item.toUpperCase()}**\n`
                                        + `<:adicionar:1403214675872579725> Adicionados: ${added}\n`
                                        + `<:remover:1403214664946417664> Removidos: ${removed}\n`;
                    }
                    if (categoriaItems) {
                        embed.addFields({ name: `**${categoryNames[categoriaKey]}**`, value: categoriaItems, inline: false });
                    }
                }
                
                await interaction.reply({ embeds: [embed] });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('listaritens')
                .setDescription('Lista todos os itens válidos.'),
            async execute(interaction) {
                // Comando agora visível para todos, sem verificação de role.
                const itensValidos = readJSON(itensValidosFilePath);
                const lista = Object.entries(itensValidos).map(([cat, items]) => {
                    const itemNames = items.map(item => item.name).join(', ');
                    return `**${cat.toUpperCase()}**\n- ${itemNames}\n`;
                }).join('\n');
                return interaction.reply({ content: `**Lista de Itens Válidos:**\n\n${lista}`, flags: InteractionResponseFlags.Ephemeral });
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('redefinir-item')
                .setDescription('Redefine o saldo de um item no baú para zero.')
                .addStringOption(option =>
                    option.setName('item')
                        .setDescription('O nome do item para redefinir.')
                        .setRequired(true)),
            async execute(interaction) {
                if (!interaction.member.roles.cache.has(RESPONSAVEL_BAU_ROLE_ID)) {
                    return interaction.reply({ content: '<a:c_warningrgbFXP:1403098424689033246> Você não tem permissão para usar este comando, somente <@&1354892378757922877>.', flags: InteractionResponseFlags.Ephemeral });
                }

                const itemName = interaction.options.getString('item').toLowerCase();
                const bauData = readJSON(bauFilePath);

                if (!bauData[itemName]) {
                    return interaction.reply({ content: `O item '${itemName}' não foi encontrado no baú.`, flags: InteractionResponseFlags.Ephemeral });
                }

                delete bauData[itemName];
                saveJSON(bauFilePath, bauData);
                await interaction.reply({ content: `O saldo do item '${itemName}' foi redefinido com sucesso!`, flags: InteractionResponseFlags.Ephemeral });

                const logChannel = client.channels.cache.get(BOT_LOG_CHANNEL_ID);
                if (logChannel) {
                    const logMessage = `<:SlashCommands:1402754768702672946> | O item \`${itemName}\` do baú foi redefinido por <@${interaction.user.id}> (local do comando: <#${interaction.channel.id}>).`;
                    await logChannel.send({ content: logMessage }).catch(console.error);
                }
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('resetbau')
                .setDescription('Redefine todo o baú e histórico de movimentações.'),
            async execute(interaction) {
                if (!interaction.member.roles.cache.has(RESPONSAVEL_BAU_ROLE_ID)) {
                    return interaction.reply({ content: '<a:c_warningrgbFXP:1403098424689033246> Você não tem permissão para usar este comando, somente <@&1354892378757922877>.', flags: InteractionResponseFlags.Ephemeral });
                }

                const bauData = {};
                const movimentacoes = [];
                
                saveJSON(bauFilePath, bauData);
                saveJSON(movimentacoesFilePath, movimentacoes);

                await interaction.reply({ content: '<a:like1:1369644902010458143> O baú e todo o histórico de movimentações foram limpos!!', flags: InteractionResponseFlags.Ephemeral });

                const logChannel = client.channels.cache.get(BOT_LOG_CHANNEL_ID);
                if (logChannel) {
                    const logMessage = `<:SlashCommands:1402754768702672946> | O baú foi limpo por <@${interaction.user.id}> (local do comando: <#${interaction.channel.id}>).`;
                    await logChannel.send({ content: logMessage }).catch(console.error);
                }
            }
        },
        {
            data: new SlashCommandBuilder()
                .setName('bau-setup')
                .setDescription('Inicializa a mensagem fixa do baú com botões.'),
            async execute(interaction) {
                if (!interaction.member.roles.cache.has(RESPONSAVEL_BAU_ROLE_ID)) {
                    return interaction.reply({ content: '<a:c_warningrgbFXP:1403098424689033246> Você não tem permissão para usar este comando, somente <@&1354892378757922877>.', flags: InteractionResponseFlags.Ephemeral });
                }
                
                if (interaction.channel.id !== BAU_CHANNEL_ID) {
                    return interaction.reply({ content: `Este comando só pode ser usado no canal <#${BAU_CHANNEL_ID}>.`, flags: InteractionResponseFlags.Ephemeral });
                }
                const embed = new EmbedBuilder()
                    .setTitle('📦 **Sistema de Controle de Baú**')
                    .setDescription(`- Use os botões abaixo para **registrar a entrada ou saída de itens** do baú da org. Ao clicar, preencha corretamente corretamente o formulário.
> <:avisos:1402749723634303060> Tudo é registrado automaticamente e pode ser consultado com o comando \`/bau\`.

### <a:fixclandst:1402749610040098908> Itens Registrados:

**<:arma:1403097746788974723> Armas/Munições:**
AK 47 / Five Seven / Uzi / PDW / Munição 762 / Munição 380

**<a:z_diamond:1391511772267286538> Materiais/Equipamentos:**
Ferro / Colete / Kit de Reparo / C4

**📱 Diversos:**
Celular / Radio / Capuz / Chaves (Amarela, Verde, Vermelha) / Ticket Corrida

**🍔 Comida/Bebida:**
Balde de Frango, Refrigerante, Batata Frita, Cachorro Quente, Água

<a:c_warningrgbFXP:1403098424689033246> **Registre apenas itens reais**. Uso incorreto pode gerar punições.

-# Atenciosamente,
-# Alta Cúpula`)
                    .setColor(0x0099ff)
                    .setThumbnail(client.user.displayAvatarURL());

                // Botões na mesma ActionRow para ficarem lado a lado
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('add_item').setLabel('Adicionou Item').setStyle(ButtonStyle.Success).setEmoji('<a:positivo:1402749751056797707>'),
                    new ButtonBuilder().setCustomId('remove_item').setLabel('Removeu Item').setStyle(ButtonStyle.Danger).setEmoji('<a:negativo:1402749793553350806>')
                );

                await interaction.channel.send({
                    embeds: [embed],
                    components: [actionRow]
                });
                await interaction.reply({ content: 'Mensagem de baú inicializada!', flags: InteractionResponseFlags.Ephemeral });
            }
        }
    ];

    // Adiciona os comandos à coleção do cliente
    for (const command of commands) {
        client.commands.set(command.data.name, command);
    }
    
    // Listeners para interações de botões e modais
    client.on('interactionCreate', async interaction => {
        if (interaction.isButton()) {
            if (interaction.channel.id !== BAU_CHANNEL_ID) return;
            if (interaction.customId === 'add_item' || interaction.customId === 'remove_item') {
                const action = interaction.customId === 'add_item' ? 'Adicionar' : 'Remover';
                const modal = new ModalBuilder()
                    .setCustomId(`bau_modal_${interaction.customId}`)
                    .setTitle(`${action} Item do Baú`);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rg_input').setLabel("RG").setStyle(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('item_input').setLabel("Nome do Item").setStyle(1).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('quantity_input').setLabel("Quantidade").setStyle(1).setRequired(true))
                );

                await interaction.showModal(modal);
            }
        } else if (interaction.type === InteractionType.ModalSubmit) {
            if (interaction.customId === 'bau_modal_add_item' || interaction.customId === 'bau_modal_remove_item') {
                const rg = interaction.fields.getTextInputValue('rg_input');
                const itemName = interaction.fields.getTextInputValue('item_input').toLowerCase();
                const quantity = parseInt(interaction.fields.getTextInputValue('quantity_input'), 10);
                const actionType = interaction.customId.includes('add') ? 'adicionou' : 'removeu';

                if (isNaN(quantity) || quantity <= 0) {
                    return interaction.reply({ content: 'A quantidade deve ser um número inteiro positivo.', flags: InteractionResponseFlags.Ephemeral });
                }

                await registerSingleMovement(interaction, rg, itemName, quantity, actionType);
            }
        }
    });
};