const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, DiscordAPIError } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

const BANCO_DIR = path.resolve(__dirname, '..', 'banco');
const MEMBROS_DB_FILE = path.join(BANCO_DIR, 'membrosDB.json');

module.exports = (client) => {
    const cargosIDsHierarquia = [
        "1375935975007584370", // Founder
        "1384183546712690830", // Co-Founder
        "1382726991433695374", // Patrão
        "1375935972986060871", // Braço Direito
        "1375935982775308442", // Conselheiro
        "1398655309907497000", // Gerente Geral
        "1375936983469129872", // Gerente De Ações
        "1382727498290167898", // Gerente De Farm
        "1375936755240403095", // Gerente de Recrutamento
        "1369700639424380948", // Líder Elite Urso
        "1369700644125933598", // Líder Elite Moscou
        "1398650789647618088", // Dono da Boca
        "1398650785025491086", // Chefe do Crime
        "1398650781632299048", // Chefe
        "1398650778603749527", // Linha de Frente
        "1398650774698856570", // Assassino
        "1398650770731040860", // Terrorista
        "1398650767136657480", // Fogueteiro
        "1398650762682171432", // Traficante
        "1375866771180880054", // Vapor
        "1375866771361239130", // 171
        "1375866771466358885", // 157
        "1375866772267208756", // 155
        "1375866772867256330", // Olheiro
        "1375866774217822319", // Cria
        "1375866775014608999"  // Sub Cria
    ];

    const comandoMembros = {
        data: new SlashCommandBuilder()
            .setName('membros')
            .setDescription('Gera o relatório de membros da Rússia.'),

        async execute(interaction) {
            await interaction.deferReply();

            const guild = interaction.guild;
            const channelId = '1404163287490236417';
            const channel = guild.channels.cache.get(channelId);

            if (!channel) {
                return interaction.editReply({
                    content: 'Não foi possível encontrar o canal de controle de membros.',
                });
            }

            try {
                const fetchedMessages = await channel.messages.fetch({ limit: 50 });
                const oldBotMessages = fetchedMessages.filter(msg => msg.author.id === client.user.id);
                if (oldBotMessages.size > 0) {
                    await channel.bulkDelete(oldBotMessages);
                }
            } catch (error) {
                console.error('Erro ao tentar apagar a(s) mensagem(ns) antiga(s):', error);
            }

            const membrosPorCargo = {};
            const cargosNome = {};

            await guild.members.fetch();
            await guild.roles.fetch();

            const processedMembers = new Set();

            cargosIDsHierarquia.forEach(cargoId => {
                const role = guild.roles.cache.get(cargoId);
                if (role) {
                    cargosNome[cargoId] = role.name;
                    membrosPorCargo[cargoId] = [];
                }
            });

            for (const cargoId of cargosIDsHierarquia) {
                const role = guild.roles.cache.get(cargoId);
                if (role) {
                    guild.members.cache.forEach(member => {
                        if (!processedMembers.has(member.id) && member.roles.cache.has(cargoId)) {
                            const nickname = member.nickname || member.user.username;
                            const match = nickname.match(/「.*?」(.+?)(?:「(\d+)」)?$/);
                            const nomeFormatado = match ? match[1].trim() : nickname.trim();
                            const idFormatado = match && match[2] ? ` - ${match[2]}` : '';
                            
                            membrosPorCargo[cargoId].push(`${nomeFormatado}${idFormatado}`);
                            processedMembers.add(member.id);
                        }
                    });
                }
            }

            const pages = [];
            let currentPageEmbed = createBaseEmbed(client, interaction);
            let currentFieldCount = 0;
            const maxFieldsPerPage = 20;

            for (const cargoId of cargosIDsHierarquia) {
                const membros = membrosPorCargo[cargoId];
                if (membros && membros.length > 0) {
                    const totalMembros = membros.length;
                    
                    const mention = `<@&${cargoId}> (${totalMembros}):\n`;
                    let membrosTexto = '';
                    let fieldCountForCargo = 0;
                    
                    membros.forEach((membro) => {
                        const novaLinha = membro + '\n';
                        
                        let totalLength = membrosTexto.length + novaLinha.length;
                        if (fieldCountForCargo === 0) {
                            totalLength += mention.length;
                        }

                        if (totalLength > 1024 || (currentFieldCount >= maxFieldsPerPage && fieldCountForCargo === 0)) {
                            if (currentFieldCount > 0) {
                                pages.push(currentPageEmbed);
                                currentPageEmbed = createBaseEmbed(client, interaction);
                                currentFieldCount = 0;
                            }
                            
                            if (totalLength > 1024) {
                                const fieldName = (fieldCountForCargo === 0) 
                                    ? `\u200b`
                                    : `\u200b`;

                                const fieldValue = (fieldCountForCargo === 0)
                                    ? mention + membrosTexto
                                    : membrosTexto;

                                currentPageEmbed.addFields({ name: fieldName, value: fieldValue });
                                currentFieldCount++;
                            }
                            
                            membrosTexto = novaLinha;
                            fieldCountForCargo++;
                            
                        } else {
                            membrosTexto += novaLinha;
                        }
                    });

                    if (membrosTexto.length > 0) {
                        const fieldName = `\u200b`;
                        const fieldValue = (fieldCountForCargo === 0)
                            ? mention + membrosTexto
                            : membrosTexto;
                        
                        currentPageEmbed.addFields({ name: fieldName, value: fieldValue });
                        currentFieldCount++;

                        if (currentFieldCount >= maxFieldsPerPage) {
                            pages.push(currentPageEmbed);
                            currentPageEmbed = createBaseEmbed(client, interaction);
                            currentFieldCount = 0;
                        }
                    }
                }
            }

            if (currentFieldCount > 0) {
                pages.push(currentPageEmbed);
            }

            try {
                const membrosData = await fs.readFile(MEMBROS_DB_FILE, 'utf8');
                const membrosDB = JSON.parse(membrosData);
                
                const recentMembersList = [];
                let totalRecentMembers = 0;

                for (const userId in membrosDB) {
                    if (Object.prototype.hasOwnProperty.call(membrosDB, userId) && Array.isArray(membrosDB[userId])) {
                        const registrations = membrosDB[userId];
                        for (const reg of registrations) {
                            const dataEntrada = new Date(reg.dataRegistro).toLocaleDateString('pt-BR');
                            recentMembersList.push(`${reg.nomeSobrenome} - ${reg.rg} | ${dataEntrada}`);
                            totalRecentMembers++;
                        }
                    }
                }

                if (recentMembersList.length > 0) {
                    let lastPage = pages[pages.length - 1];
                    if (!lastPage || lastPage.data.fields.length >= maxFieldsPerPage) {
                        lastPage = createBaseEmbed(client, interaction);
                        pages.push(lastPage);
                    }
                    
                    const recentMembersText = recentMembersList.join('\n').substring(0, 1024);
                    lastPage.addFields({
                        name: `<:ponto:1404150420883898510> Registrados Recentemente (${totalRecentMembers}):`,
                        value: recentMembersText,
                    });
                }
            } catch (error) {
                console.error('[MEMBROS] Erro ao ler membrosDB.json:', error);
                if (pages.length > 0) {
                    pages[pages.length - 1].addFields({
                        name: 'Erro ao carregar registros recentes',
                        value: 'Não foi possível carregar a lista de registros recentes.',
                    });
                }
            }
            
            const successMessage = {
                content: '<a:setabranca:1403599822207979562> Relatório de membros atualizado com sucesso em <#1404163287490236417>!',
                ephemeral: false
            };

            const getRow = (currentPage) => {
                const prevButton = new ButtonBuilder()
                    .setCustomId(`prev_page_${currentPage}`)
                    .setLabel('Anterior')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0);

                const nextButton = new ButtonBuilder()
                    .setCustomId(`next_page_${currentPage}`)
                    .setLabel('Próximo')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === pages.length - 1);
                
                const pageNumberButton = new ButtonBuilder()
                    .setCustomId('page_number')
                    .setLabel(`Página ${currentPage + 1}/${pages.length}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                return new ActionRowBuilder().addComponents(prevButton, pageNumberButton, nextButton);
            };

            if (pages.length <= 1) {
                 await channel.send({ embeds: [pages[0]] });
                 try {
                     await interaction.editReply(successMessage);
                 } catch (error) {
                     if (error instanceof DiscordAPIError && error.code === 10008) {
                     } else {
                         console.error('Erro ao editar a resposta da interação:', error);
                     }
                 }
                 return;
            }

            const initialMessage = await channel.send({
                embeds: [pages[0]],
                components: [getRow(0)],
            });
            
            try {
                await interaction.editReply(successMessage);
            } catch (error) {
                if (error instanceof DiscordAPIError && error.code === 10008) {
                } else {
                    console.error('Erro ao editar a resposta da interação:', error);
                }
            }
        },
    };

    function createBaseEmbed(client, interaction) {
        const dataHoraAtual = new Date();
        const dataFormatada = dataHoraAtual.toLocaleDateString('pt-BR');
        const horaFormatada = dataHoraAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return new EmbedBuilder()
            .setTitle('<:Russia:1403568543622238238> CONTROLE DE MEMBROS DA RÚSSIA')
            .setDescription('<a:setabranca:1403599822207979562> Segue abaixo a lista oficial dos membros da Rússia.\n> Os cargos estão listados em ordem hierárquica, mostrando a quantidade e os nomes de cada integrante.\n\n> A Lista é atualizada automaticamente com o comando `/membros`')
            .setColor('Blue')
            .setImage('https://cdn.discordapp.com/attachments/1402835801741590713/1404170361054167162/MEMRBOS.png?ex=689a370e&is=6898e58e&hm=79f86a304c68fee4624a39a8bd8f71a39638d2d929e59d63abd85c934dd99e28&')
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({
                text: `Atualizado em ${dataFormatada} às ${horaFormatada} por ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            });
    }

    client.commands.set(comandoMembros.data.name, comandoMembros);

    // Novo manipulador para os botões de paginação
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;
        
        // Verifica se a interação do botão pertence ao comando de membros
        if (interaction.customId.startsWith('prev_page_') || interaction.customId.startsWith('next_page_')) {
            await interaction.deferUpdate();

            const customIdParts = interaction.customId.split('_');
            const action = customIdParts[0];
            let currentPage = parseInt(customIdParts[2]);

            // Recria a lista de páginas
            const pages = [];
            const guild = interaction.guild;
            const membrosPorCargo = {};
            const cargosNome = {};

            await guild.members.fetch();
            await guild.roles.fetch();

            const processedMembers = new Set();
            cargosIDsHierarquia.forEach(cargoId => {
                const role = guild.roles.cache.get(cargoId);
                if (role) {
                    cargosNome[cargoId] = role.name;
                    membrosPorCargo[cargoId] = [];
                }
            });

            for (const cargoId of cargosIDsHierarquia) {
                const role = guild.roles.cache.get(cargoId);
                if (role) {
                    guild.members.cache.forEach(member => {
                        if (!processedMembers.has(member.id) && member.roles.cache.has(cargoId)) {
                            const nickname = member.nickname || member.user.username;
                            const match = nickname.match(/「.*?」(.+?)(?:「(\d+)」)?$/);
                            const nomeFormatado = match ? match[1].trim() : nickname.trim();
                            const idFormatado = match && match[2] ? ` - ${match[2]}` : '';
                            membrosPorCargo[cargoId].push(`${nomeFormatado}${idFormatado}`);
                            processedMembers.add(member.id);
                        }
                    });
                }
            }

            let currentPageEmbed = createBaseEmbed(client, interaction);
            let currentFieldCount = 0;
            const maxFieldsPerPage = 20;

            for (const cargoId of cargosIDsHierarquia) {
                const membros = membrosPorCargo[cargoId];
                if (membros && membros.length > 0) {
                    const totalMembros = membros.length;
                    const mention = `<@&${cargoId}> (${totalMembros}):\n`;
                    let membrosTexto = '';
                    let fieldCountForCargo = 0;
                    membros.forEach((membro) => {
                        const novaLinha = membro + '\n';
                        let totalLength = membrosTexto.length + novaLinha.length;
                        if (fieldCountForCargo === 0) totalLength += mention.length;

                        if (totalLength > 1024 || (currentFieldCount >= maxFieldsPerPage && fieldCountForCargo === 0)) {
                            if (currentFieldCount > 0) {
                                pages.push(currentPageEmbed);
                                currentPageEmbed = createBaseEmbed(client, interaction);
                                currentFieldCount = 0;
                            }
                            if (totalLength > 1024) {
                                currentPageEmbed.addFields({ name: (fieldCountForCargo === 0) ? `\u200b` : `\u200b`, value: (fieldCountForCargo === 0) ? mention + membrosTexto : membrosTexto });
                                currentFieldCount++;
                            }
                            membrosTexto = novaLinha;
                            fieldCountForCargo++;
                        } else {
                            membrosTexto += novaLinha;
                        }
                    });
                    if (membrosTexto.length > 0) {
                        currentPageEmbed.addFields({ name: `\u200b`, value: (fieldCountForCargo === 0) ? mention + membrosTexto : membrosTexto });
                        currentFieldCount++;
                        if (currentFieldCount >= maxFieldsPerPage) {
                            pages.push(currentPageEmbed);
                            currentPageEmbed = createBaseEmbed(client, interaction);
                            currentFieldCount = 0;
                        }
                    }
                }
            }

            if (currentFieldCount > 0) pages.push(currentPageEmbed);
            try {
                const membrosData = await fs.readFile(MEMBROS_DB_FILE, 'utf8');
                const membrosDB = JSON.parse(membrosData);
                const recentMembersList = [];
                let totalRecentMembers = 0;
                for (const userId in membrosDB) {
                    if (Object.prototype.hasOwnProperty.call(membrosDB, userId) && Array.isArray(membrosDB[userId])) {
                        const registrations = membrosDB[userId];
                        for (const reg of registrations) {
                            const dataEntrada = new Date(reg.dataRegistro).toLocaleDateString('pt-BR');
                            recentMembersList.push(`${reg.nomeSobrenome} - ${reg.rg} | ${dataEntrada}`);
                            totalRecentMembers++;
                        }
                    }
                }
                if (recentMembersList.length > 0) {
                    let lastPage = pages[pages.length - 1];
                    if (!lastPage || lastPage.data.fields.length >= maxFieldsPerPage) {
                        lastPage = createBaseEmbed(client, interaction);
                        pages.push(lastPage);
                    }
                    const recentMembersText = recentMembersList.join('\n').substring(0, 1024);
                    lastPage.addFields({ name: `<:ponto:1404150420883898510> Registrados Recentemente (${totalRecentMembers}):`, value: recentMembersText });
                }
            } catch (error) {
                console.error('[MEMBROS] Erro ao ler membrosDB.json:', error);
                if (pages.length > 0) {
                    pages[pages.length - 1].addFields({ name: 'Erro ao carregar registros recentes', value: 'Não foi possível carregar a lista de registros recentes.' });
                }
            }
            
            if (action === 'prev') {
                currentPage--;
            } else if (action === 'next') {
                currentPage++;
            }

            if (currentPage < 0) currentPage = 0;
            if (currentPage >= pages.length) currentPage = pages.length - 1;

            const getNewRow = (currentPage, totalPages) => {
                const prevButton = new ButtonBuilder()
                    .setCustomId(`prev_page_${currentPage}`)
                    .setLabel('Anterior')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0);

                const nextButton = new ButtonBuilder()
                    .setCustomId(`next_page_${currentPage}`)
                    .setLabel('Próximo')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1);
                
                const pageNumberButton = new ButtonBuilder()
                    .setCustomId('page_number')
                    .setLabel(`Página ${currentPage + 1}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                return new ActionRowBuilder().addComponents(prevButton, pageNumberButton, nextButton);
            };

            await interaction.editReply({
                embeds: [pages[currentPage]],
                components: [getNewRow(currentPage, pages.length)],
            });
        }
    });
};

function createBaseEmbed(client, interaction) {
    const dataHoraAtual = new Date();
    const dataFormatada = dataHoraAtual.toLocaleDateString('pt-BR');
    const horaFormatada = dataHoraAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return new EmbedBuilder()
        .setTitle('<:Russia:1403568543622238238> CONTROLE DE MEMBROS DA RÚSSIA')
        .setDescription('<a:setabranca:1403599822207979562> Segue abaixo a lista oficial dos membros da Rússia.\n> Os cargos estão listados em ordem hierárquica, mostrando a quantidade e os nomes de cada integrante.\n\n> A Lista é atualizada automaticamente com o comando `/membros`')
        .setColor('Blue')
        .setImage('https://cdn.discordapp.com/attachments/1402835801741590713/1404170361054167162/MEMRBOS.png?ex=689a370e&is=6898e58e&hm=79f86a304c68fee4624a39a8bd8f71a39638d2d929e59d63abd85c934dd99e28&')
        .setThumbnail(client.user.displayAvatarURL())
        .setFooter({
            text: `Atualizado em ${dataFormatada} às ${horaFormatada} por ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL()
        });
}