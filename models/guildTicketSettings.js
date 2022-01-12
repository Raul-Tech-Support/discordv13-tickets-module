const mongoose = require('mongoose');

const GuildTicketSettingsSchema = new mongoose.Schema({
	guildID: { type: String },
	guildEmbedTitle: { type: String },
	guildEmbedDescription: { type: String },
	guildEmbedFooterText: { type: String },
	guildEmbedColour: { type: String },
	guildTicketReason1: { type: String },
	guildTicketReason2: { type: String },
	guildTicketReason3: { type: String },
	guildTicketReason4: { type: String },
	guildTicketReason5: { type: String },
	guildStaffRoleName: { type: String },
	guildTicketOpenMessage: { type: String },
	guildTicketOpenEmbedDescription: { type: String },
	guildTicketEmbedFooterText: { type: String },
	guildOpenCategory: { type: String },
	guildTranscript: { type: Boolean },
	guildTranscriptLogChannel: { type: String },
});

module.exports = mongoose.model('GuildTicketSettings', GuildTicketSettingsSchema);