const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const mongoose = require('mongoose');
const guildTicketSettings = require('./models/guildTicketSettings.js');
const guildTickets = require('./models/guildTickets.js');

//Must be called on startup - OTHER FUNCTIONS WILL WORK UNTIL THIS IS CALLED.
async function initialise() {
	try {
		mongoose.connect(process.env.MONGO_URL, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		console.log('[TICKETS] Initialised sucessfully!');
		return true;
	}
	catch (error) {
		console.error('[TICKETS] Failed to connect to the database!', error);
		return false;
	}
}

async function getGuildSettings(guild) {
	let ticketSettings;

	//Get guildTicketSettings from database if it exists, else generate a new one.
	try {
		ticketSettings = await guildTicketSettings.findOne({ guildID: guild.id });
		if (!ticketSettings) {
			const guildSetup = new guildTicketSettings({
				guildID: guild.id,
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
		return ticketSettings;
	}
	catch (error) {
		console.log(error);
	}
}

async function open(guild, user, ticketReasonID) {
	let ticketReason, OpenCategory, newChannel;

	const ticketSettings = await getGuildSettings(guild);

	//Find staff role as specified in the database, if not found return and inform user.
	const staffRole = await guild.roles.cache.find(
		role => role.name === ticketSettings.guildStaffRoleName,
	);

	if (!staffRole) return 'No staff role';

	//Set reason for ticket message.
	switch (ticketReasonID)	{
	case 1:
		ticketReason = ticketSettings.guildTicketReason1;
		break;
	case 2:
		ticketReason = ticketSettings.guildTicketReason2;
		break;
	case 3:
		ticketReason = ticketSettings.guildTicketReason3;
		break;
	case 4:
		ticketReason = ticketSettings.guildTicketReason4;
		break;
	case 5:
		ticketReason = ticketSettings.guildTicketReason5;
		break;
	default:
		return 'Invalid ticketReasonID provided';
	}

	//Begin opening ticket and creating embed & close button.
	const ticketEmbed = new MessageEmbed()
		.setTitle(`${user.username} - ${ticketReason}`)
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
		OpenCategory = guild.channels.cache.find(c => c.name === ticketSettings.guildOpenCategory);
	}
	catch {
		return 'Parent not found';
	}

	//Check if user already has a ticket in DB.
	try {
		const query = await guildTickets.find({ guildID: guild.id, 'tickets.authorID':  user.id });
		if (query.length !== 0) {
			return 'Already has ticket';
		}
	}
	catch (error) {
		console.error(error);
		return 'Could not fetch ticket ownership status';
	}

	await guild.channels.create(`ticket-${user.username}`, {
		parent: OpenCategory,
		permissionOverwrites: [
			{
				id: user.id,
				allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
			},
			{
				id: guild.roles.everyone,
				deny: ['VIEW_CHANNEL'],
			},
			{
				id: staffRole,
				allow: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
			},
		],
		type: 'text',
		topic: user.id,
		reason: 'Ticket Creation',
	}).then(async channel => {
		newChannel = channel.id;
		channel.send({ content: `<@${user.id}> ${ticketSettings.guildTicketOpenMessage}`, embeds: [ticketEmbed], components: [closeTicketButton] });

		//Create new ticket log.
		const ticket = {
			authorID: user.id,
			channelID: channel.id,
		};

		//Add new ticket log to DB.
		try {
			await guildTickets.findOneAndUpdate({
				guildID: guild.id,
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
			return 'Failed to save ticket to DB';
		}
	});

	return newChannel;
}

async function close(channel, guild, member, client) {

	//Check channel is a ticket.
	if (!channel.name.includes('ticket-')) return 'Not an open ticket';
	let staffRole;

	const ticketSettings = await getGuildSettings(guild);

	//Create & send/log transcript.
	if (ticketSettings.guildTranscript === true) {

		const transcript = await discordTranscripts.createTranscript(channel);

		const ticketClosedEmbed = new MessageEmbed()
			.setTitle('Ticket Closed')
			.setDescription(`Ticket created by: <@${channel.topic}>\n Ticket closed by: ${member}\n Ticket name: ${channel.name}`)
			.setFooter({ text: ticketSettings.guildTicketEmbedFooterText })
			.setColor('RANDOM');

		try {
			const ticketOwner = guild.members.cache.get(channel.topic);
			await ticketOwner.send({ content: `Thank you for contacting ${guild.name} support! A copy of the chat transcript can be downloaded below.`, files: [transcript] });
		}
		catch (error) {
			if (!error === 'Cannot read properties of undefined (reading \'send\')') {
				console.error(error);
			}
		}

		try {
			const c = await client.channels.fetch(ticketSettings.guildTranscriptLogChannel);
			c.send({ embeds: [ticketClosedEmbed], files: [transcript] });
		}
		catch (error) {
			await channel.send({ content: 'Could not log transcript! Have you set a transcript log channel? The transcript has been attached below', files: [transcript] }).catch(() => { return 'Could not log transcript'; });
		}
	}

	try {
		staffRole = await guild.roles.cache.find(
			role => role.name === ticketSettings.guildStaffRoleName,
		);
	}
	catch (error) {
		console.error(error);
	}

	//Change ticket to closed in channel name and remove creators permissions.
	const newChannelName = channel.name.replace('ticket', 'closed');
	try {
		await channel.edit({
			permissionOverwrites: [
				{
					id: channel.topic,
					null: ['SEND_MESSAGES', 'VIEW_CHANNEL'],
				},
				{
					id: guild.roles.everyone,
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
		await guildTickets.updateOne({ guildID: guild.id }, { $pull: { 'tickets': { authorID: channel.topic } } });
		return 'Success';
	}
	catch (error) {
		console.error(error);
		return 'Failed to edit DB';
	}
}

async function deleteTicket(channel) {

	//If ticket is not a closed ticket return with error message.
	try {
		if (!channel.name.includes('closed-')) return 'Not a closed ticket';
	}
	catch {
		return 'Probably deleted';
	}

	try {
		await channel.delete('Ticket Deleted');
		return 'Success';
	}
	catch {
		return 'Failed to delete';
	}
}

async function setup(guild, channelID) {

	const ticketSettings = await getGuildSettings(guild);

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
		return 'No reasons';
	}

	//Construct panel.
	const panel = new MessageEmbed()
		.setTitle(ticketSettings.guildEmbedTitle)
		.setDescription(ticketSettings.guildEmbedDescription)
		.setFooter({ text: ticketSettings.guildEmbedFooterText })
		.setColor(ticketSettings.guildEmbedColour);

	//Find channel, then clear it of messages then send panel with open buttons.
	try {
		const channel = guild.channels.cache.find(c => c.id === channelID);
		await channel.bulkDelete(100);
		await channel.send({ embeds: [panel], components: [openTicketButtons] });
		return 'Ticket panel created';
	}
	catch (error) {
		console.log(error);
		return 'Error creating ticket panel';
	}
}

async function editSettings(guild, option, value) {

	if (option === 'paneltitle') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildEmbedTitle: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'paneldescription') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildEmbedDescription: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'embedfooter') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildEmbedFooterText: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'embedcolour') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildEmbedColour: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'reason1') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketReason1: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'reason2') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketReason2: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'reason3') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketReason3: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'reason4') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketReason4: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'reason5') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketReason5: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'staffrole') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildStaffRoleName: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'ticketopenmessage') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketOpenMessage: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'ticketopenembed') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketOpenEmbedDescription: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'ticketopenembedfooter') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTicketEmbedFooterText: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'opencategory') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildOpenCategory: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'transcript') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTranscript: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}
	else if (option === 'transcriptlogchannel') {
		try {
			await guildTicketSettings.updateOne({ guildID: guild.id }, { $set: { guildTranscriptLogChannel: value } });
		}
		catch (error) {
			console.log(error);
			return 'Could not update database';
		}
	}

	return 'Settings updated sucessfully';
}

async function alertOwner(message) {

	const ticketSettings = await getGuildSettings(message.guild);

	//If not a ticket channel return.
	if (!message.channel.name.includes('ticket-')) return;

	//If message author is ticket owner, message author is a bot or message author is not a "Staff member" return.
	if (message.author.id === message.channel.topic || message.author.bot || !message.member.roles.cache.find(role => role.name === ticketSettings.guildStaffRoleName)) return;

	//Ping ticket owner then delete.
	try {
		message.channel.send(`A new reply has been added to your ticket <@${message.channel.topic}>`).then(msg => {
			setTimeout(() => msg.delete(), 100);
		});
		return 'success';
	}
	catch (error) {
		return error;
	}
}

async function removeDBTicket(channel) {

	try {
		if (!channel.name.includes('ticket-')) return;
	}
	catch (error) {
		return error;
	}

	//Delete ticket from DB
	try {
		await guildTickets.updateOne({ guildID: channel.guild.id }, { $pull: { 'tickets': { authorID: channel.topic } } });
		return 'Success';
	}
	catch (error) {
		console.error(error);
		return error;
	}

}

module.exports.initialise = initialise;
module.exports.open = open;
module.exports.close = close;
module.exports.deleteTicket = deleteTicket;
module.exports.setup = setup;
module.exports.editSettings = editSettings;
module.exports.alertOwner = alertOwner;
module.exports.removeDBTicket = removeDBTicket;