const mongoose = require('mongoose');

const GuildTicketsSchema = new mongoose.Schema({
	guildId: {
		type: String,
		required: true,
	},
	tickets: {
		type: [Object],
		required: true,
	},
});

module.exports = mongoose.model('GuildTickets', GuildTicketsSchema);