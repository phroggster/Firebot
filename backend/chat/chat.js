"use strict";
const EventEmitter = require("events");
const Mixer = require('@mixer/client-node');
const ws = require('ws');

const logger = require("../logwrapper");
const accountAccess = require("../common/account-access");

const client = require("../mixer-client/client");

/**
 * Creates a Mixer chat socket and authenticates
 * @param {string} accountType The type of account to connect with ('streamer' or 'bot')
 * @returns {Promise.<Mixer.Socket>}
 */
async function joinChat(accountType) {

    let channelId, userId;
    if (accountType === "streamer") {
        const streamer = accountAccess.getAccounts().streamer;
        channelId = streamer.channelId;
        userId = streamer.userId;
    } else {
        const bot = accountAccess.getAccounts().bot;
        channelId = bot.channelId;
        userId = bot.userId;
    }

    const joinInformation = await client.getChatConnectionInformation(accountType);

    const socket = new Mixer.Socket(ws, joinInformation.endpoints).boot();

    return socket.auth(channelId, userId, joinInformation.authkey).then(() => socket);
}

/**
 * Ensure a socket is closed
 * @param {Mixer.Socket} socket A socket
 */
function ensureSocketIsClosed(socket) {
    if (socket && socket.getStatus() !== Mixer.Socket.CLOSED && socket.getStatus() !== Mixer.Socket.CLOSING) {
        socket.close();
    }
}

/**
 * Sets up listeners for the streamer socket
 * @param {Mixer.Socket} streamerSocket The streamers socket
 */
function setupStreamerSocketListeners(streamerSocket) {

}

/**
 * Sets up listeners for the bot socket
 * @param {Mixer.Socket} botSocket The bots socket
 * @param {NodeJS.EventEmitter} eventEmitter The MixerChat event emitter
 */
function setupBotSocketListeners(botSocket, eventEmitter) {
    botSocket.on("ChatMessage", data => {
        // if someone whispers the bot account, we want to act on that
        if (data.message.meta.whisper) {
            //commandHandler.handleChatEvent(data);
            if (data.user_name !== accountAccess.getAccounts().streamer.username) {
                // Send to UI to show in chat window.
                //chatProcessor.uiChatMessage(data);
            }
        }
    });

    botSocket.on('error', error => {
        logger.error("Bot chat socket error", error);
    });

    botSocket.on('reconnecting', () => {

    });

    botSocket.on('closed', () => {});
}

/**@extends NodeJS.EventEmitter */
class MixerChat extends EventEmitter {

    constructor() {
        super();

        /** @type {Mixer.Socket} */
        this._streamerSocket = null;
        /** @type {Mixer.Socket} */
        this._botSocket = null;
    }


    /**
     * Whether or not the streamer and bot (if logged in) sockets are currently connected
     */
    chatIsConnected() {
        const bot = accountAccess.getAccounts().bot;
        return this._streamerSocket && this._streamerSocket.isConnected() &&
            (!bot.loggedIn || (this._botSocket && this._botSocket.isConnected()));
    }

    /**
     * Connects the streamer and bot chat sockets
     */
    async connect() {
        const accounts = accountAccess.getAccounts();
        if (!accounts.streamer.loggedIn) return;

        // Ensure previous streamer socket is closed
        ensureSocketIsClosed(this._streamerSocket);

        // join chat with streamer
        this._streamerSocket = await joinChat('streamer');

        // join chat with bot, if its logged in
        if (accounts.bot.loggedIn) {
            // Ensure previous bot socket is closed
            ensureSocketIsClosed(this._botSocket);

            this._botSocket = await joinChat('bot');
        }
    }

    /**
     * Disconnects the streamer and bot chat sockets
     */
    disconnect() {
        ensureSocketIsClosed(this._streamerSocket);
        ensureSocketIsClosed(this._botSocket);

        this.emit("chat-disconnected");

        // tell front end chat is no longer connecting
    }


    /**
     * Sends the message as the bot if available, otherwise as the streamer.
     * If a username is provided, the message will be whispered.
     * If the message is too long, it will be automatically broken into multiple fragments and sent individually.
     *
     * @param {string} message The message to send
     * @param {string} [username] If provided, message will be whispered to the given user.
     * @param {string} [accountType] Which account to chat as. Defaults to bot if available otherwise, the streamer.
     */
    async sendChatMessage(message, username, accountType) {
        if (message == null) return null;

        const botAvailable = accountAccess.getAccounts().bot.loggedIn;
        if (accountType == null) {
            accountType = botAvailable ? "bot" : "streamer";
        } else if (accountType === "bot" && !botAvailable) {
            accountType = "streamer";
        }

        const shouldWhisper = username != null && username.trim() !== "";

        // split message into fragments that don't exceed the max message length
        const messageFragments = message.match(/[\s\S]{1,360}/g)
            .map(mf => mf.trim())
            .filter(mf => mf !== "");


        /**@type Promise<Mixer.IChatMessage>[] */
        const messageRequests = [];

        // Send all message fragments
        for (let fragment of messageFragments) {
            if (shouldWhisper) {
                messageRequests.push(this._whisper(fragment, username, accountType));
            } else {
                messageRequests.push(this._broadcast(fragment, accountType));
            }
        }

        return Promise.all(messageRequests);
    }

    /**
     * Sends a chat message to the streamers chat (INTERNAL USE ONLY)
     * @param {string} message The message to send
     * @param {string} accountType The type of account to whisper with ('streamer' or 'bot')
     * @returns {Promise<Mixer.IChatMessage>} The sent message
     */
    async _broadcast(message, accountType) {
        const socket = accountType === 'streamer' ? this._streamerSocket : this._botSocket;
        try {
            logger.debug(`Sending message as ${accountType}.`);
            return await socket.call("msg", [message]);
        } catch (error) {
            logger.error(`Error attempting to send message with ${accountType}`, error);
            return null;
        }
    }


    /**
     * Sends a whisper to the given user (INTERNAL USE ONLY)
     * @param {string} message The message to send
     * @param {string} username Who to whisper the message to
     * @param {string} accountType The type of account to whisper with ('streamer' or 'bot')
     * @returns {Promise<Mixer.IChatMessage>} The sent message
     */
    async _whisper(message, username, accountType) {
        const socket = accountType === 'streamer' ? this._streamerSocket : this._botSocket;
        try {
            logger.debug(`Sending message as ${accountType}.`);
            return await socket.call("whisper", [username, message]);
        } catch (error) {
            logger.error(`Error attempting to send whisper to ${username} with ${accountType}`, error);
            return null;
        }
    }

    /** Request previous messages from this chat from before you joined. */
    async getChatHistory() {
        try {
            return this._streamerSocket.call("history", [100]);
        } catch (error) {
            logger.error("Error attempting to retrieve chat history", error);
            return [];
        }
    }

    /**
     * Deletes a chat message
     * @param {string} messageId The id of the message to delete
     * @returns {Promise<boolean>} Whether or not deletion was successful
     */
    async deleteMessage(messageId) {
        try {
            await this._streamerSocket.call("deleteMessage", [messageId]);
            return true;
        } catch (error) {
            logger.error(`Error attempting to delete message ${messageId}`, error);
            return false;
        }
    }

    /**
     * Clears all messages from chat
     * @returns {Promise<boolean>} Whether or not the clear was successful
     */
    async clearChat() {
        try {
            await this._streamerSocket.call("clearMessages", []);
            return true;
        } catch (error) {
            logger.error(`Error attempting to clear chat`, error);
            return false;
        }
    }

    /**
     * Time a user out and purge their chat messages. They cannot send messages until the duration is over.
     * The user being timed out must be in the channel.
     * @param {string} username The username of the user who will be timed out
     * @param {string} duration The duration for which the user will be unable to send messages.
     * A human-readable duration with units can be provided (such as '30s' or '1m15s'), or providing no unit will
     * result in the value being taken as seconds. You can also use the string 'clear' to clear a timeout.
     * @returns {Promise<boolean>} Whether or not purge was successful
     */
    async timeoutUser(username, duration) {
        try {
            await this._streamerSocket.call("timeout", [username, duration]);
            return true;
        } catch (error) {
            logger.error(`Error attempting to timeout user ${username} for ${duration}`, error);
            return false;
        }
    }


    /**
     * Purge a user's messages from chat without timing them out
     * @param {string} username The username of the user to purge
     * @returns {Promise<boolean>} Whether or not purge was successful
     */
    async purgeUserMessages(username) {
        try {
            await this._streamerSocket.call("purge", [username]);
            return true;
        } catch (error) {
            logger.error(`Error attempting to purge user ${username}`, error);
            return false;
        }
    }

    /**
     * Starts a Mixer giveaway
     * @returns {Promise<boolean>} Whether or not starting the giveway was successful
     */
    async startGiveaway() {
        try {
            await this._streamerSocket.call("giveaway:start", []);
            return true;
        } catch (error) {
            logger.error(`Error attempting to start giveaway`);
            return false;
        }
    }
}

module.exports = new MixerChat();