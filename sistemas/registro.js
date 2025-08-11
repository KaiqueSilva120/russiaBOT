const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const connectToDatabase = require('../database');
const RegistroPendente = require('../models/RegistroPendente'); // Caminho atualizado
const Membro = require('../models/Membro'); // Caminho atualizado

const BANCO_DIR = path.resolve(__dirname, '..', 'banco');
const REGISTRO_ID_FILE = path.join(BANCO_DIR, 'registroID.json');

let configIDs = {};

/**
 * Carrega o arquivo JSON de configuração.
 */
async function loadConfig() {
    try {
        await fs.mkdir(BANCO_DIR, { recursive: true });
        
        if (await fs.access(REGISTRO_ID_FILE).then(() => true).catch(() => false)) {
            const configData = await fs.readFile(REGISTRO_ID_FILE, 'utf8');
            configIDs = JSON.parse(configData);
            console.log('[REGISTRO] Configurações carregadas com sucesso do registroID.json.');
            return true;
        } else {
            console.error('[REGISTRO] Arquivo registroID.json não encontrado. O sistema não pode ser iniciado.');
            return false;
        }
    } catch (error) {
        console.error('[REGISTRO] Erro ao carregar o arquivo registroID.json:', error);
        return false;
    }
}

/**
 * Limpa os registros de membros mais antigos que 7 dias do banco de dados.
 */
async function clearOldRecords() {
    try {
        const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        const result = await Membro.deleteMany({
            dataRegistro: { $lt: sevenDaysAgo }
        });
        if (result.deletedCount > 0) {
            console.log(`[REGISTRO] ${result.deletedCount} registros de membros antigos foram removidos.`);
        }
    } catch (error) {
        console.error('[REGISTRO] Erro ao limpar registros antigos:', error);
    }
}

/**
 * Envia ou verifica o painel de registro no canal especificado.
 * @param {Client} client - A instância do cliente Discord.
 */
async function setupPanel(client) {
    if (!configIDs.REGISTRO_CHANNEL_ID) return;

    try {
        const channel = await client.channels.fetch(configIDs.REGISTRO_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 100 });
        const existingPanel = messages.find(msg =>
            msg.author.id === client.user.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title === 'FAÇA SEU REGISTRO'
        );

        if (!existingPanel) {
            const embed = new EmbedBuilder()
                .setTitle('FAÇA SEU REGISTRO')
                .setDescription(
                    `Seja Bem Vindo(a) !! <a:like1:1369644902010458143>\n` +
                    `> Para liberarmos o seu acesso, precisamos que você complete seu registro.\n\n` +
                    `- Basta clicar no botão "<:Russia:1403568543622238238> Realizar Registro" abaixo e responder às perguntas solicitadas.\n` +
                    `Assim que validarmos suas informações, seu acesso será liberado.`
                )
                .setColor('#2b2d31')
                .setImage('https://cdn.discordapp.com/attachments/1242690408782495757/1403567335104581775/REGISTRE-SE.png?ex=68980571&is=6896b3f1&hm=7bc6594172e26aebc3eed95618bd10bdbda3e0ed17a4d799b606d22d1895951e&')
                .setFooter({ text: 'Registro Oficial da Rússia • Bem-vindo à Família' });

            const button = new ButtonBuilder()
                .setCustomId('registro_btn')
                .setLabel('Realizar Registro')
                .setEmoji('1403568543622238238')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(button);

            await channel.send({ embeds: [embed], components: [row] });
        }
    } catch (error) {
        // Sem logs no console como solicitado pelo usuário
    }
}

/**
 * Cria a embed de registro pendente.
 * ... (código da função createPendingEmbed sem alterações)
 */
function createPendingEmbed(registro, member) {
    const embed = new EmbedBuilder()
        .setTitle('🟡 | REGISTRO PENDENTE')
        .setColor('#ffcc00')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
            { name: 'Membro', value: `<@${member.id}>` },
            { name: 'Nome e Sobrenome', value: `\`\`\`${registro.nomeSobrenome}\`\`\``, inline: true },
            { name: 'RG', value: `\`\`\`${registro.rg}\`\`\``, inline: true },
            { name: 'Telefone', value: `\`\`\`${registro.telefone}\`\`\``, inline: true },
            { name: 'Recrutador', value: `\`\`\`${registro.recrutador}\`\`\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'STATUS DO REGISTRO: PENDENTE' });
    return embed;
}

/**
 * Cria a embed de registro aprovado.
 * ... (código da função createApprovedEmbed sem alterações)
 */
function createApprovedEmbed(registro, member, cargo, staff) {
    const embed = new EmbedBuilder()
        .setTitle('✅ | REGISTRO APROVADO')
        .setColor('#008000')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
            { name: 'Nome e Sobrenome', value: `\`\`\`${registro.nomeSobrenome}\`\`\``, inline: true },
            { name: 'RG', value: `\`\`\`${registro.rg}\`\`\``, inline: true },
            { name: 'Telefone', value: `\`\`\`${registro.telefone}\`\`\``, inline: true },
            { name: 'Recrutador', value: `\`\`\`${registro.recrutador}\`\`\``, inline: true },
            { name: 'Cargo:', value: `<@&${cargo.id}>`, inline: true },
            { name: 'Registro Aceito por:', value: `<@${staff.id}>`, inline: true },
            { name: 'Data da resposta:', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'STATUS DO REGISTRO: ACEITO' });
    return embed;
}

/**
 * Cria a embed de registro negado.
 * ... (código da função createDeniedEmbed sem alterações)
 */
function createDeniedEmbed(registro, member, motivo, staff) {
    const embed = new EmbedBuilder()
        .setTitle('❌ | REGISTRO RECUSADO')
        .setColor('#ff0000')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
            { name: 'Nome e Sobrenome', value: `\`\`\`${registro.nomeSobrenome}\`\`\``, inline: true },
            { name: 'RG', value: `\`\`\`${registro.rg}\`\`\``, inline: true },
            { name: 'Telefone', value: `\`\`\`${registro.telefone}\`\`\``, inline: true },
            { name: 'Recrutador', value: `\`\`\`${registro.recrutador}\`\`\``, inline: true },
            { name: 'Motivo do Registro Negado:', value: motivo, inline: false },
            { name: 'Registro Negado por:', value: `<@${staff.id}>`, inline: true },
            { name: 'Data da resposta:', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'STATUS DO REGISTRO: NEGADO' });
    return embed;
}

/**
 * Função principal para configurar o sistema de registro.
 * @param {Client} client - A instância do cliente Discord.
 */
function setup(client) {
    client.once('ready', async () => {
        const configLoaded = await loadConfig();
        if (configLoaded) {
            const isConnected = await connectToDatabase();
            if (isConnected) {
                await setupPanel(client);
                await clearOldRecords();
            }
        }
    });

    client.on('guildMemberAdd', async member => {
        const registroPendenteRole = member.guild.roles.cache.get(configIDs.REGISTRO_PENDENTE_ROLE_ID);
        if (registroPendenteRole) {
            try {
                await member.roles.add(registroPendenteRole);
            } catch (error) {
                console.error('Erro ao adicionar o cargo de Registro Pendente:', error);
            }
        }
    });

    client.on('interactionCreate', async interaction => {
        if (interaction.isButton() && interaction.customId === 'registro_btn') {
            const member = interaction.member;
            
            if (!member.roles.cache.has(configIDs.REGISTRO_PENDENTE_ROLE_ID)) {
                return interaction.reply({ content: `Você não tem permissão para realizar o registro. O cargo de <@&1354976408090185809> é necessário.`, ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('registro_modal')
                .setTitle('Faça seu Registro');
            
            const nomeSobrenomeInput = new TextInputBuilder()
                .setCustomId('nomeSobrenome')
                .setLabel('Nome e Sobrenome')
                .setPlaceholder('Ex: Aurelio Silva')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const rgInput = new TextInputBuilder()
                .setCustomId('rg')
                .setLabel('RG')
                .setPlaceholder('Ex: 12345')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const telefoneInput = new TextInputBuilder()
                .setCustomId('telefone')
                .setLabel('Telefone')
                .setPlaceholder('Ex: 000-000')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            
            const recrutadorInput = new TextInputBuilder()
                .setCustomId('recrutador')
                .setLabel('Recrutador')
                .setPlaceholder('Ex: Eugenio')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nomeSobrenomeInput),
                new ActionRowBuilder().addComponents(rgInput),
                new ActionRowBuilder().addComponents(telefoneInput),
                new ActionRowBuilder().addComponents(recrutadorInput)
            );

            await interaction.showModal(modal);
        }

        if (interaction.isModalSubmit() && interaction.customId === 'registro_modal') {
            await interaction.deferReply({ ephemeral: true });
            const member = interaction.member;
            const guild = interaction.guild;

            const nomeSobrenome = interaction.fields.getTextInputValue('nomeSobrenome');
            let rg = interaction.fields.getTextInputValue('rg');
            let telefone = interaction.fields.getTextInputValue('telefone');
            const recrutador = interaction.fields.getTextInputValue('recrutador');

            if (nomeSobrenome.split(' ').length < 2) {
                return interaction.editReply('Por favor, insira seu nome e sobrenome completos.');
            }

            if (!telefone.includes('-') && telefone.length === 6) {
                telefone = `${telefone.slice(0, 3)}-${telefone.slice(3)}`;
            }

            const pendingChannel = guild.channels.cache.get(configIDs.PENDING_REGISTRATIONS_CHANNEL_ID);
            if (!pendingChannel) {
                return interaction.editReply('Não foi possível encontrar o canal de registros pendentes.');
            }

            try {
                const existingRegistro = await RegistroPendente.findOne({ userId: member.id });
                if (existingRegistro) {
                    return interaction.editReply('Você já tem um registro pendente. Aguarde a aprovação.');
                }
            } catch (err) {
                console.error('Erro ao verificar registro pendente:', err);
                return interaction.editReply('Ocorreu um erro ao verificar seu registro.');
            }

            const registroData = { nomeSobrenome, rg, telefone, recrutador, userId: member.id };
            const embed = createPendingEmbed(registroData, member);

            const buttonsRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`aprovar_${member.id}`).setLabel('Aprovar Registro').setEmoji('1403203942573150362').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`negar_${member.id}`).setLabel('Negar Registro').setEmoji('1403204560058585138').setStyle(ButtonStyle.Danger)
                );
            
            const message = await pendingChannel.send({
                content: `<a:info:1402749673076166810> | Registro recebido de: <@${member.id}>\n<:Russia:1403568543622238238> | <@&${configIDs.RESPONSAVEL_REGISTRO_ROLE_ID}>`,
                embeds: [embed],
                components: [buttonsRow]
            });

            await RegistroPendente.create({
                ...registroData,
                messageId: message.id
            });

            await interaction.editReply({ content: `<a:info:1402749673076166810> Olá <@${member.id}>, seu registro foi enviado para Análise.` });
        }

        if (interaction.isButton() && (interaction.customId.startsWith('aprovar_') || interaction.customId.startsWith('negar_'))) {
            const userId = interaction.customId.split('_')[1];
            const isAprovar = interaction.customId.startsWith('aprovar_');

            const registro = await RegistroPendente.findOne({ userId });

            if (!registro) {
                return interaction.reply({ content: 'Este registro não existe ou já foi processado.', ephemeral: true });
            }

            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && !interaction.member.roles.cache.has(configIDs.RESPONSAVEL_REGISTRO_ROLE_ID)) {
                return interaction.reply({ content: 'Você não tem permissão para aprovar ou negar registros.', ephemeral: true });
            }

            if (isAprovar) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`select_role_${userId}`)
                    .setPlaceholder('Selecione o cargo do membro');
                
                const rolesOptions = configIDs.roles.slice(0, 25).map(role => new StringSelectMenuOptionBuilder()
                    .setLabel(role.name)
                    .setValue(role.id));
                
                selectMenu.addOptions(rolesOptions);

                const row = new ActionRowBuilder().addComponents(selectMenu);
                
                await interaction.reply({ content: 'Selecione o cargo do membro:', components: [row], ephemeral: true });
            } else {
                const modal = new ModalBuilder()
                    .setCustomId(`negar_modal_${userId}`)
                    .setTitle('Negar Registro');

                const motivoInput = new TextInputBuilder()
                    .setCustomId('motivo')
                    .setLabel('Motivo da negação')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
                await interaction.showModal(modal);
            }
        }

        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_role_')) {
            await interaction.deferUpdate();

            const userId = interaction.customId.split('_')[2];
            const cargoId = interaction.values[0];
            const registro = await RegistroPendente.findOne({ userId });

            if (!registro) {
                return interaction.editReply('Este registro não existe ou já foi processado.');
            }

            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (!member) {
                return interaction.editReply('Membro não encontrado.');
            }

            const cargo = interaction.guild.roles.cache.get(cargoId);
            const memberRole = interaction.guild.roles.cache.get(configIDs.RUSSIAN_MEMBER_ROLE_ID);
            
            if (!cargo || !memberRole) {
                return interaction.editReply('Um dos cargos não foi encontrado.');
            }

            await member.roles.remove(configIDs.REGISTRO_PENDENTE_ROLE_ID).catch(() => {});
            await member.roles.add([cargoId, configIDs.RUSSIAN_MEMBER_ROLE_ID]).catch(() => {});

            const simplifiedName = configIDs.roles.find(r => r.id === cargoId)?.simplified;
            const newNick = `「${simplifiedName}」${registro.nomeSobrenome}「${registro.rg}」`;

            await member.setNickname(newNick).catch(() => {});

            // Salva o registro no banco de membros
            await Membro.create({
                userId: registro.userId,
                nomeSobrenome: registro.nomeSobrenome,
                rg: registro.rg,
                cargoId: cargoId,
                dataRegistro: new Date()
            });

            const pendingChannel = interaction.guild.channels.cache.get(configIDs.PENDING_REGISTRATIONS_CHANNEL_ID);
            const pendingMessage = await pendingChannel.messages.fetch(registro.messageId);
            const approvedEmbed = createApprovedEmbed(registro, member, cargo, interaction.user);
            
            await pendingMessage.edit({
                content: `<a:info:1402749673076166810> | Registro recebido de: <@${userId}>\n<:Russia:1403568543622238238> | <@&${configIDs.RESPONSAVEL_REGISTRO_ROLE_ID}>`,
                embeds: [approvedEmbed],
                components: []
            });

            // Deleta o registro pendente do banco de dados
            await RegistroPendente.deleteOne({ userId });

            await interaction.editReply({ content: '<a:positivo:1402749751056797707> Registro aprovado com sucesso!', components: [] });
        }
        
        if (interaction.isModalSubmit() && interaction.customId.startsWith('negar_modal_')) {
            await interaction.deferReply({ ephemeral: true });
            const userId = interaction.customId.split('_')[2];
            const motivo = interaction.fields.getTextInputValue('motivo');

            const registro = await RegistroPendente.findOne({ userId });

            if (!registro) {
                return interaction.editReply('Este registro não existe ou já foi processado.');
            }
            
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (!member) {
                return interaction.editReply('Membro não encontrado.');
            }

            const pendingChannel = interaction.guild.channels.cache.get(configIDs.PENDING_REGISTRATIONS_CHANNEL_ID);
            const pendingMessage = await pendingChannel.messages.fetch(registro.messageId);
            const deniedEmbed = createDeniedEmbed(registro, member, motivo, interaction.user);
            
            // Deleta a mensagem do canal de registros pendentes
            await pendingMessage.delete();

            // Envia a embed de registro negado para o canal de logs
            const deniedLogsChannel = interaction.guild.channels.cache.get(configIDs.DENIED_LOGS_CHANNEL_ID);
            if (deniedLogsChannel) {
                await deniedLogsChannel.send({ embeds: [deniedEmbed] });
            }

            // Deleta o registro pendente do banco de dados
            await RegistroPendente.deleteOne({ userId });

            await interaction.editReply('<a:negativo:1402749793553350806> Registro negado com sucesso!');
        }
    });
}

module.exports = setup;