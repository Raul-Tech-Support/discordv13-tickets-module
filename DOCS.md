initialise()
    Must be called on "start". No other functions will operate correctly if this is not called. Returns true if the connection was successfull or false if an error occured.

open(guild, user, ticketReasonID)
    Open a ticket, you MUST pass in the guild that this is being executed from, the user and the ticketReasonID (A number from 1-5, returns "Invalid ticketReasonID provided" if an invalid number is provided.)
    Fetches guildTicketSettings from database, returns "Error" if this fails and logs the error to the console.
    Fetches the staffRole from the database, returns "No staff role" if it cannot be found.
    Fetches open category from the database, returns "Parent not found" if it cannot be found.
    Checks whether user already has a ticket from database, returns "Already has ticket" if the user already has a ticket, returns "Could not fetch ticket ownership status" if unable to fetch from the database.
    Saves ticket to database, if this is successfull the ticket has been fully created successfully and returns the channel ID, if this fails returns "Failed to save ticket to DB"

setup(guild, channelID)
    Creates a ticket panel in the channel specified channelID.
    Fetches guildTicketSettings from database, returns "Error" if this fails and logs the error to the console.
    Gets ticket reasons from DB, returns "No reasons" if no reasons are found.
    Creates ticket panel and returns "Ticket panel created" if successfull, or "Error creating ticket panel" if an error occurs and logs the error to the console.

editSettings(guild, option, value)
    Edits the guild's settings. 
    Fetches guildTicketSettings from database, returns "Error" if this fails and logs the error to the console.
    Updates value in database, returns "Could not update database", returns "Settings updated sucessfully" if settings are updated sucessfully.

close(channel, guild, member, client)
    Closes a ticket, you MUST pass in the channel (that is the ticket), the guild, the member and the client.
    Checks the channel is an open ticket, if not returns "Not an open ticket".
    Fetches guildTicketSettings from database, returns "Error" if this fails and logs the error to the console.
    If transcript is true send transcript to ticket owner and to log channel, or if log channel does not exist in the channel, returns "Could not log transcript" if fails to send transcript into the channel.
    Returns "Success" if the function completes correctly, or "Failed to edit DB" if it could not remove the ticket from the DB, the error will also be logged to console.

alertOwner(message)
    Notifies the ticket owner there is a new reply to their ticket by mentioning them (With an explanation message for push notifications)
    Checks that channel is an open ticket, then checks that message was not send by the ticket owner, a bot or by someone without the guild's staff role.
    Then sends notification message and deletes it after 100ms.

deleteTicket(channel)
    Checks to confirm the channel is a closed ticket, if not returns "Not a closed ticket".
    Deletes the channel, then returns "success" if this is successful, else returns the error.

removeDBTicket(channel)
    Checks channel is a ticket.
    Removes any tickets by this user from the DB, then returns "success" if this is successful, else returns the error.