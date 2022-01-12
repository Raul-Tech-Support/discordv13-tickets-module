const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const mongoose = require('mongoose');
const guildTicketSettings = require('./models/guildTicketSettings.js');
const guildTickets = require('./models/guildTickets.js');

async function initialise() {
	try {
		await mongoose.connect(process.env.MONGO_URL, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		console.log('[TICKETS] Initialised sucessfully!');
	}
	catch (error) {
		console.error('[TICKETS] Failed to connect to the database!', error);
	}
}

async function open(interaction, ticketReasonID) {
	let ticketSettings, ticketReason, OpenCategory;

	await interaction.deferReply({ ephemeral: true });

	//Get guildTicketSettings from database if it exists, else generate a new one.
	try {
		ticketSettings = await guildTicketSettings.findOne({ guildID: interaction.guild.id });
		if (!ticketSettings) {
			const guildSetup = new guildTicketSettings({
				guildID: interaction.guild.id,
				guildEmbedTitle: 'Create a Ticket!',
				guildEmbedDescription: 'Press a button below to open a ticket!',
				guildEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildEmbedColour: 'GREY',
				guildTicketReason1: 'General Support',
				guildTicketReason2: 'Appeal Support',
				guildTicketReason3: 'Billing Support',
				guildTicketReason4: '',
				guildTicketReason5: '',
				guildStaffRoleName: 'Staff',
				guildTicketOpenMessage: '',
				guildTicketOpenEmbedDescription: 'Please begin writing your query, a member of staff will respond soon!',
				guildTicketEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildOpenCategory: 'Tickets',
				guildTranscript: true,
				guildTranscriptLogChannel: '',
			});

			await guildSetup.save();
			ticketSettings = guildSetup;
		}
	}
	catch (error) {
		console.error(error);
	}

	//Find staff role as specified in the database, if not found return and inform user.
	const staffRole = await interaction.guild.roles.cache.find(
		role => role.name === ticketSettings.guildStaffRoleName,
	);

	if (!staffRole) return await interaction.editReply({ content: 'This panel has been setup incorrectly! Please contact a staff member.', ephemeral: true });

	//Set reason for ticket message.
	switch (ticketReasonID)	{
	case '1':
		ticketReason = ticketSettings.guildTicketReason1;
		break;
	case '2':
		ticketReason = ticketSettings.guildTicketReason2;
		break;
	case '3':
		ticketReason = ticketSettings.guildTicketReason3;
		break;
	case '4':
		ticketReason = ticketSettings.guildTicketReason4;
		break;
	case '5':
		ticketReason = ticketSettings.guildTicketReason5;
		break;
	default:
		return await interaction.editReply({ content: 'This interaction is linked to an invalid ticket type!', ephemeral: true });
	}

	//Begin opening ticket with informing user and creating embed & close button.
	await interaction.editReply({ content: 'Creating a ticket....', ephemeral: true });
	const ticketEmbed = new MessageEmbed()
		.setTitle(`${interaction.user.username} - ${ticketReason}`)
		.setDescription(ticketSettings.guildTicketOpenEmbedDescription)
		.setFooter({ text: ticketSettings.guildTicketEmbedFooterText })
		.setColor('RANDOM');

	const closeTicketButton = new MessageActionRow()
		.addComponents(
			new MessageButton()
				.setCustomId('closeTicket')
				.setLabel('Close')
				.setEmoji('🔒')
				.setStyle('PRIMARY'),
		);

	//Find open category specified in DB, or inform user it does not exist if it is not found.
	try {
		OpenCategory = interaction.guild.channels.cache.find(c => c.name === ticketSettings.guildOpenCategory);
	}
	catch {
		return await interaction.editReply({ content: 'Could not find the specified parent category, please contact a staff member!', ephemeral: true });
	}

	//Check if user already has a ticket in DB.
	try {
		const query = await guildTickets.find({ 'authorId': { $in:'tickets' } });
		if (query.length !== 0) {
			return await interaction.editReply({ content: 'You already have an open ticket. Please close it before making a new one!' });
		}
	}
	catch (error) {
		console.error(error);
	}

	await interaction.guild.channels.create(`ticket-${interaction.user.username}`, {
		parent: OpenCategory,
		permissionOverwrites: [
			{
				id: interaction.user.id,
				allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
			},
			{
				id: interaction.guild.roles.everyone,
				deny: ['VIEW_CHANNEL'],
			},
			{
				id: staffRole,
				allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
			},
		],
		type: 'text',
		topic: interaction.user.id,
		reason: 'Ticket Creation',
	}).then(async channel => {
		channel.send({ content: `<@${interaction.user.id}> ${ticketSettings.guildTicketOpenMessage}`, embeds: [ticketEmbed], components: [closeTicketButton] });
		await interaction.editReply({ content: `Sucessfully created a ticket: ${channel}!`, ephemeral: true });

		//Create new ticket log.
		const ticket = {
			authorID: interaction.member.id,
			channelID: channel.id,
		};

		//Add new ticket log to DB.
		try {
			await guildTickets.findOneAndUpdate({
				guildId: interaction.guild.id,
			},
			{
				$push: {
					tickets: ticket,
				},
			},
			{
				upsert: true,
			});
		}
		catch (error) {
			console.log(error);
		}
	});

}

async function setup(interaction, channelID) {
	let ticketSettings;

	await interaction.deferReply({ ephemeral: true });

	//Get guildTicketSettings from database if it exists, else generate a new one.
	try {
		ticketSettings = await guildTicketSettings.findOne({ guildID: interaction.guild.id });
		if (!ticketSettings) {
			const guildSetup = new guildTicketSettings({
				guildID: interaction.guild.id,
				guildEmbedTitle: 'Create a Ticket!',
				guildEmbedDescription: 'Press a button below to open a ticket!',
				guildEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildEmbedColour: 'GREY',
				guildTicketReason1: 'General Support',
				guildTicketReason2: 'Appeal Support',
				guildTicketReason3: 'Billing Support',
				guildTicketReason4: '',
				guildTicketReason5: '',
				guildStaffRoleName: 'Staff',
				guildTicketOpenMessage: '',
				guildTicketOpenEmbedDescription: 'Please begin writing your query, a member of staff will respond soon!',
				guildTicketEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildOpenCategory: 'Tickets',
				guildTranscript: true,
				guildTranscriptLogChannel: '',
			});

			await guildSetup.save();
			ticketSettings = guildSetup;
		}
	}
	catch (error) {
		console.log(error);
		return await interaction.editReply({ content: `An error has occured: ${error}`, ephemeral: true });
	}

	//Begin creating open ticket buttons, add button if value found in DB.
	let atLeast1Button = false;
	const openTicketButtons = new MessageActionRow();
	if (ticketSettings.guildTicketReason1) {
		openTicketButtons.addComponents(
			new MessageButton()
				.setCustomId('ticketOpen1')
				.setLabel(ticketSettings.guildTicketReason1)
				.setStyle('PRIMARY'),
		);
		atLeast1Button = true;
	}
	if (ticketSettings.guildTicketReason2) {
		openTicketButtons.addComponents(
			new MessageButton()
				.setCustomId('ticketOpen2')
				.setLabel(ticketSettings.guildTicketReason2)
				.setStyle('PRIMARY'),
		);
		atLeast1Button = true;
	}
	if (ticketSettings.guildTicketReason3) {
		openTicketButtons.addComponents(
			new MessageButton()
				.setCustomId('ticketOpen3')
				.setLabel(ticketSettings.guildTicketReason3)
				.setStyle('PRIMARY'),
		);
		atLeast1Button = true;
	}
	if (ticketSettings.guildTicketReason4) {
		openTicketButtons.addComponents(
			new MessageButton()
				.setCustomId('ticketOpen4')
				.setLabel(ticketSettings.guildTicketReason4)
				.setStyle('PRIMARY'),
		);
		atLeast1Button = true;
	}
	if (ticketSettings.guildTicketReason5) {
		openTicketButtons.addComponents(
			new MessageButton()
				.setCustomId('ticketOpen5')
				.setLabel(ticketSettings.guildTicketReason5)
				.setStyle('PRIMARY'),
		);
		atLeast1Button = true;
	}
	//If no buttons were added return error message.
	if (atLeast1Button === false) {
		return await interaction.editReply({ content: 'This panel has no buttons assigned. Please add one or more before creating a panel.' });
	}

	//Construct panel.
	const panel = new MessageEmbed()
		.setTitle(ticketSettings.guildEmbedTitle)
		.setDescription(ticketSettings.guildEmbedDescription)
		.setFooter({ text: ticketSettings.guildEmbedFooterText })
		.setColor(ticketSettings.guildEmbedColour);

	//Find channel, then clear it of messages then send panel with open buttons.
	try {
		const channel = interaction.guild.channels.cache.find(c => c.id === channelID);
		await channel.bulkDelete(100);
		await channel.send({ embeds: [panel], components: [openTicketButtons] });
		await interaction.editReply({ content:'Ticket panel created!', ephemeral: true });
	}
	catch (error) {
		console.log(error);
		return await interaction.editReply({ content:`Error creating ticket panel: ${error}`, ephemeral: true });
	}
}

async function editSettings(interaction, option, value) {

	let ticketSettings;

	await interaction.deferReply({ ephemeral: true });

	//Get guildTicketSettings from database if it exists, else generate a new one.
	try {
		ticketSettings = await guildTicketSettings.findOne({ guildID: interaction.guild.id });
		if (!ticketSettings) {
			const guildSetup = new guildTicketSettings({
				guildID: interaction.guild.id,
				guildEmbedTitle: 'Create a Ticket!',
				guildEmbedDescription: 'Press a button below to open a ticket!',
				guildEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildEmbedColour: 'GREY',
				guildTicketReason1: 'General Support',
				guildTicketReason2: 'Appeal Support',
				guildTicketReason3: 'Billing Support',
				guildTicketReason4: '',
				guildTicketReason5: '',
				guildStaffRoleName: 'Staff',
				guildTicketOpenMessage: '',
				guildTicketOpenEmbedDescription: 'Please begin writing your query, a member of staff will respond soon!',
				guildTicketEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildOpenCategory: 'Tickets',
				guildTranscript: true,
				guildTranscriptLogChannel: '',
			});

			await guildSetup.save();
			ticketSettings = guildSetup;
		}
	}
	catch (error) {
		console.error(error);
	}


	if (option === 'paneltitle') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildEmbedTitle: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'paneldescription') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildEmbedDescription: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'embedfooter') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildEmbedFooterText: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'embedcolour') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildEmbedColour: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'reason1') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketReason1: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'reason2') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketReason2: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'reason3') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketReason3: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'reason4') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketReason4: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'reason5') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketReason5: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'staffrole') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildStaffRoleName: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'ticketopenmessage') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketOpenMessage: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'ticketopenembed') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketOpenEmbedDescription: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'ticketopenembedfooter') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTicketEmbedFooterText: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'opencategory') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildOpenCategory: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'transcript') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTranscript: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}
	else if (option === 'transcriptlogchannel') {
		try {
			await guildTicketSettings.updateOne({ guildID: interaction.guild.id }, { $set: { guildTranscriptLogChannel: value } });
		}
		catch (error) {
			console.log(error);
			return await interaction.editReply({ content: 'Could not add new value to the database!' });
		}
	}

	//Finally
	await interaction.editReply({ content: 'Success! Settings have been updated sucessfully, please remember to remake the panel if you have updated it.' });
}

async function close(interaction, client) {

	await interaction.deferReply();

	//Check channel is a ticket.
	if (!interaction.channel.name.includes('ticket-')) return interaction.editReply({ content: 'This is not an open ticket! Has it already been closed?' });
	let ticketSettings, staffRole;

	//Get guildTicketSettings from database if it exists, else generate a new one.
	try {
		ticketSettings = await guildTicketSettings.findOne({ guildID: interaction.guild.id });
		if (!ticketSettings) {
			const guildSetup = new guildTicketSettings({
				guildID: interaction.guild.id,
				guildEmbedTitle: 'Create a Ticket!',
				guildEmbedDescription: 'Press a button below to open a ticket!',
				guildEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildEmbedColour: 'GREY',
				guildTicketReason1: 'General Support',
				guildTicketReason2: 'Appeal Support',
				guildTicketReason3: 'Billing Support',
				guildTicketReason4: '',
				guildTicketReason5: '',
				guildStaffRoleName: 'Staff',
				guildTicketOpenMessage: '',
				guildTicketOpenEmbedDescription: 'Please begin writing your query, a member of staff will respond soon!',
				guildTicketEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildOpenCategory: 'Tickets',
				guildTranscript: true,
				guildTranscriptLogChannel: '',
			});

			await guildSetup.save();
			ticketSettings = guildSetup;
		}
	}
	catch (error) {
		console.error(error);
	}

	//Create & send/log transcript.
	if (ticketSettings.guildTranscript === true) {

		const transcriptChannel = interaction.channel;
		const ticketOwnerID = interaction.channel.topic;
		const transcript = await discordTranscripts.createTranscript(transcriptChannel);

		const ticketClosedEmbed = new MessageEmbed()
			.setTitle('Ticket Closed')
			.setDescription(`Ticket created by: <@${ticketOwnerID}>\n Ticket closed by: ${interaction.member}\n Ticket name: ${interaction.channel.name}`)
			.setFooter({ text: ticketSettings.guildTicketEmbedFooterText })
			.setColor('RANDOM');

		try {
			const ticketOwner = interaction.guild.members.cache.get(interaction.channel.topic);
			await ticketOwner.send({ content: `Thank you for contacting ${interaction.guild.name} support! A copy of the chat transcript can be downloaded below.`, files: [transcript] });
		}
		catch (error) {
			console.error(error);
		}

		try {
			const c = await client.channels.fetch(ticketSettings.guildTranscriptLogChannel);
			c.send({ embeds: [ticketClosedEmbed], files: [transcript] });
		}
		catch (error) {
			await interaction.channel.send({ content: 'Could not log transcript! Have you set a transcript log channel? The transcript has been attached below', files: [transcript] }).catch((e) => { return interaction.editReply({ content: `An error has occured: ${e}` }); });
		}
	}

	try {
		staffRole = await interaction.guild.roles.cache.find(
			role => role.name === ticketSettings.guildStaffRoleName,
		);
	}
	catch (error) {
		console.error(error);
	}

	//Change ticket to closed in channel name and remove creators permissions.
	const newChannelName = interaction.channel.name.replace('ticket', 'closed');
	try {
		await interaction.channel.edit({
			permissionOverwrites: [
				{
					id: interaction.channel.topic,
					null: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
				},
				{
					id: interaction.guild.roles.everyone,
					deny: ['VIEW_CHANNEL'],
				},
				{
					id: staffRole,
					allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
					deny: ['MANAGE_MESSAGES'],
				},
			],
			name: newChannelName,
			reason: 'Ticket Closed',
		});
	}
	catch (error) {
		console.error(error);
	}

	//Delete ticket from DB
	try {
		await guildTickets.deleteMany({ authorId: { authorId: interaction.member.id } });
	}
	catch (error) {
		console.error(error);
	}

	//Create and send closed Embed & buttons.
	const closedTicketEmbed = new MessageEmbed()
		.setTitle('Ticket Closed')
		.setDescription(`Ticket closed by ${interaction.user.tag}`)
		.setFooter({ text: ticketSettings.guildTicketEmbedFooterText })
		.setColor('RANDOM');

	const closedTicketOptionsButton = new MessageActionRow()
		.addComponents(
			new MessageButton()
				.setCustomId('deleteTicket')
				.setLabel('Delete')
				.setEmoji('⛔')
				.setStyle('DANGER'),
		)
		.addComponents(
			new MessageButton()
				.setCustomId('reopenTicket')
				.setLabel('Re-Open')
				.setEmoji('🔓')
				.setStyle('SECONDARY'),
		);

	await interaction.editReply({ embeds: [closedTicketEmbed], components: [closedTicketOptionsButton] });
}

async function alertOwner(message) {
	let ticketSettings;

	//Get guildTicketSettings from database if it exists, else generate a new one.
	try {
		ticketSettings = await guildTicketSettings.findOne({ guildID: message.guild.id });
		if (!ticketSettings) {
			const guildSetup = new guildTicketSettings({
				guildID: message.guild.id,
				guildEmbedTitle: 'Create a Ticket!',
				guildEmbedDescription: 'Press a button below to open a ticket!',
				guildEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildEmbedColour: 'GREY',
				guildTicketReason1: 'General Support',
				guildTicketReason2: 'Appeal Support',
				guildTicketReason3: 'Billing Support',
				guildTicketReason4: '',
				guildTicketReason5: '',
				guildStaffRoleName: 'Staff',
				guildTicketOpenMessage: '',
				guildTicketOpenEmbedDescription: 'Please begin writing your query, a member of staff will respond soon!',
				guildTicketEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildOpenCategory: 'Tickets',
				guildTranscript: true,
				guildTranscriptLogChannel: '',
			});

			await guildSetup.save();
			ticketSettings = guildSetup;
		}
	}
	catch (error) {
		console.error(error);
	}

	//If not a ticket channel return.
	if (!message.channel.name.includes('ticket-')) return;

	//If message author is ticket owner, message author is a bot or message author is not a "Staff member" return.
	if (message.author.id === message.channel.topic || message.author.bot || !message.member.roles.cache.find(role => role.name === ticketSettings.guildStaffRoleName)) return;

	//Ping ticket owner then delete.
	message.channel.send(`A new reply has been added to your ticket <@${message.channel.topic}>`).then(msg => {
		setTimeout(() => msg.delete(), 100);
	});


}

async function deleteTicket(interaction) {

	await interaction.deferReply();

	//If ticket is not a closed ticket return with error message.
	if (!interaction.channel.name.includes('closed-')) return await interaction.editReply({ content: 'This is not a closed ticket!' });

	//Else delete ticket after 5 seconds.
	interaction.message.delete().then(() => {
		interaction.editReply({ content: 'Deleting ticket in 5 seconds!' }).then(() => {
			setTimeout(async () => {
				if (!interaction.channel.name.includes('closed-')) return await interaction.editReply({ content: 'Ticket deletion canceled!' });
				interaction.channel.delete('Deleting Ticket');
			}, 5000);
		});
	});
}

async function removeDBTicket(channel) {

	if (!channel.name.includes('ticket-')) return;

	let ticketSettings;

	//Get guildTicketSettings from database if it exists, else generate a new one.
	try {
		ticketSettings = await guildTicketSettings.findOne({ guildID: channel.guild.id });
		if (!ticketSettings) {
			const guildSetup = new guildTicketSettings({
				guildID: channel.guild.id,
				guildEmbedTitle: 'Create a Ticket!',
				guildEmbedDescription: 'Press a button below to open a ticket!',
				guildEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildEmbedColour: 'GREY',
				guildTicketReason1: 'General Support',
				guildTicketReason2: 'Appeal Support',
				guildTicketReason3: 'Billing Support',
				guildTicketReason4: '',
				guildTicketReason5: '',
				guildStaffRoleName: 'Staff',
				guildTicketOpenMessage: '',
				guildTicketOpenEmbedDescription: 'Please begin writing your query, a member of staff will respond soon!',
				guildTicketEmbedFooterText: 'Discord Ticket System - Created by RaulTechSupport',
				guildOpenCategory: 'Tickets',
				guildTranscript: true,
				guildTranscriptLogChannel: '',
			});

			await guildSetup.save();
			ticketSettings = guildSetup;
		}
	}
	catch (error) {
		console.error(error);
	}


	//Delete ticket from DB
	try {
		await guildTickets.deleteMany({ authorId: { authorId: channel.topic } });
	}
	catch (error) {
		console.error(error);
	}

}

module.exports.initialise = initialise;
module.exports.open = open;
module.exports.setup = setup;
module.exports.editSettings = editSettings;
module.exports.close = close;
module.exports.alertOwner = alertOwner;
module.exports.deleteTicket = deleteTicket;
module.exports.removeDBTicket = removeDBTicket;