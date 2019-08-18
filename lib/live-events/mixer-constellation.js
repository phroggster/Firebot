'use strict';

const {ipcMain} = require('electron');
const Carina = require('carina').Carina;
const ws = require('ws');
const dataAccess = require('../common/data-access.js');
const eventsRouter = require('../live-events/events-router.js');
const { LiveEvent, EventSourceType, EventType } = require('./EventType');
const reconnectService = require('../common/reconnect.js');
const logger = require('../logwrapper');
const patronageManager = require("../patronageManager");
const apiAccess = require("../api-access");

Carina.WebSocket = ws;

// This holds the constellation connection so we can stop it later.
let ca = {};

// This holds the connection status of constellation.
let constellationConnected = false;

// last sub cache
global.lastSub = "";

function setLastSub(username) {
    logger.info(`Setting last sub to: ${username}`);
    global.lastSub = username;
}

// Constellation Connect
// This will connect to constellation and subscribe to all constellation events we need.
function constellationConnect() {
    let dbAuth = dataAccess.getJsonDbInUserData("/user-settings/auth"),
        streamer = dbAuth.getData('/streamer'),
        channelId = streamer.channelId;

    logger.info('Connecting to Constellation.', channelId);
    ca = new Carina({ isBot: true }).open();

    // Clear any previous subscriptions just in case something weird happens.
    ca.subscriptions = {};

    // Channel Status
    // This gets general channel data such as online status, num followers, current viewers.
    let prefix = 'channel:' + channelId + ":";
    ca.subscribe(prefix + 'update', data => {
        if (data.viewersCurrent != null) {
            renderWindow.webContents.send('currentViewersUpdate', { viewersCurrent: data.viewersCurrent });
        }
    });

    // Resub Shared (Cached Event)
    // This is a resub event in which the user manually triggered the celebration.
    ca.subscribe(prefix + 'resubShared', data => {

        logger.debug("Resub shared event", data);

        let event = new LiveEvent(EventType.SUBSCRIBED, EventSourceType.CONSTELLATION, {
            shared: true,
            username: data['user'].username,
            totalMonths: data.totalMonths
        });

        setLastSub(data.user.username);

        eventsRouter.cachedEvent(event);
    });

    // Resub (Cached Event)
    // This is a resub event in which the users payment went through, but they might not be in the channel.
    ca.subscribe(prefix + 'resubscribed', data => {

        logger.debug("Resub event", data);

        let event = new LiveEvent(EventType.SUBSCRIBED, EventSourceType.CONSTELLATION, {
            shared: false,
            username: data['user'].username,
            totalMonths: data.totalMonths
        });

        setLastSub(data.user.username);

        eventsRouter.cachedEvent(event);
    });

    // Sub (Cached Event)
    // This is an initial sub to the channel.
    ca.subscribe(prefix + 'subscribed', data => {

        logger.debug("Sub event", data);

        let event = new LiveEvent(EventType.SUBSCRIBED, EventSourceType.CONSTELLATION, {
            username: data['user'].username,
            totalMonths: 0
        });

        setLastSub(data.user.username);

        eventsRouter.cachedEvent(event);
    });

    // Sub Gifted
    ca.subscribe(prefix + 'subscriptionGifted', async data => {

        logger.debug("Sub gifted event", data);

        let giftReceiverId = data.giftReceiverId,
            gifterId = data.gifterId;

        let giftReceiverUsername, gifterUsername;
        try {
            let giftReceiverUser = await apiAccess.get(`users/${giftReceiverId}`);
            giftReceiverUsername = giftReceiverUser.username;

            let gifterUser = await apiAccess.get(`users/${gifterId}`);
            gifterUsername = gifterUser.username;
        } catch (e) {
            logger.debug("Failed to get user data, firing event anyway");
            logger.warn(e);
        }

        let event = new LiveEvent(EventType.SUB_GIFTED, EventSourceType.CONSTELLATION, {
            username: gifterUsername,
            gifterUsername: gifterUsername,
            giftReceiverUsername: giftReceiverUsername
        });

        eventsRouter.uncachedEvent(event);
    });

    // Host (Cached Event)
    // This is a channel host.
    ca.subscribe(prefix + 'hosted', data => {
        let event = new LiveEvent(EventType.HOSTED, EventSourceType.CONSTELLATION, {
            username: data['hoster'].token
        });

        eventsRouter.cachedEvent(event);
    });

    // Follow (Cached Event)
    // This is a follow event. Filters out unfollows.
    ca.subscribe(prefix + 'followed', data => {
        // Filter out the unfollows.
        if (data.following === false) {
            return;
        }

        let event = new LiveEvent(EventType.FOLLOWED, EventSourceType.CONSTELLATION, {
            username: data['user'].username
        });

        eventsRouter.cachedEvent(event);
    });

    // Skill
    ca.subscribe(prefix + 'skill', data => {

        logger.debug("Constellation Skill Event");
        logger.debug(data);

        //if gif skill effect, extract url and send to frontend
        if (data && data.manifest) {
            logger.debug("Checking skill for gif...");
            if (data.manifest.name === "giphy") {
                logger.debug("Detected gif effect type");
                if (data.parameters && data.parameters.giphyId) {
                    logger.debug("Gif url is present, building url and sending to FE/triggering event");

                    let giphyHost = data.parameters.giphyHost || "media1.giphy.com",
                        giphyId = data.parameters.giphyId;

                    let gifUrl = `https://${giphyHost}/media/${giphyId}/giphy.gif`;

                    renderWindow.webContents.send('gifUrlForSkill', {
                        executionId: data.executionId,
                        gifUrl: gifUrl
                    });

                    let userId = data.parameters.userId;
                    logger.debug("Getting user data for id '" + userId + "' so we can trigger gif event");

                    apiAccess.get(`users/${userId}`)
                        .then(userData => {

                            logger.debug("user data", userData);

                            logger.debug("Got user data, triggering gif event with url: " + gifUrl);

                            let event = new LiveEvent(EventType.SKILL_GIF, EventSourceType.CONSTELLATION, {
                                username: userData ? userData.username : "Unknown",
                                gifUrl: gifUrl
                            });

                            eventsRouter.uncachedEvent(event);
                            return;
                        }, () => {

                            logger.debug("Failed to get user data, firing event anyway");

                            let event = new LiveEvent(EventType.SKILL_GIF, EventSourceType.CONSTELLATION, {
                                username: "Unknown User",
                                gifUrl: gifUrl
                            });

                            eventsRouter.uncachedEvent(event);
                            return;
                        });
                }
            } else {
                // Check for effects or anything else.
                logger.debug("Sending mixer effect to FE/triggering event");

                let userId = data.triggeringUserId;
                logger.debug("Getting user data for id '" + userId + "' so we can trigger effect event");

                apiAccess.get(`users/${userId}`)
                    .then(userData => {
                        logger.debug("user data", userData);
                        logger.debug("Got user data, triggering effect event.");

                        let event = new LiveEvent(EventType.SKILL_EFFECTS, EventSourceType.CONSTELLATION, {
                            username: userData ? userData.username : "Unknown"
                        });

                        eventsRouter.uncachedEvent(event);
                    }, () => {
                        logger.debug("Failed to get user data, firing event anyway");

                        let event = new LiveEvent(EventType.SKILL_EFFECTS, EventSourceType.CONSTELLATION, {
                            username: "Unknown User"
                        });

                        eventsRouter.uncachedEvent(event);
                    });
            }
        }
    });

    // Patronage updates
    ca.subscribe(prefix + 'patronageUpdate', data => {

        logger.debug("patronageUpdate Event");
        logger.debug(data);

        patronageManager.setChannelPatronageData(data);
    });

    ca.on('error', data => {
        logger.error("error from constellation:", data);

        //attempt to reconnect and reset status
        constellationConnected = false;
        reconnectService.reconnect('Constellation', false, false);
    });

    // Set to connected.
    constellationConnected = true;

    // Set connection status to online
    logger.info('Constellation connected.');
    renderWindow.webContents.send('constellationConnection', "Online");
}

// Constellation Disconnect
// This will disconnect the current constellation connection and unsub from everything.
function constellationDisconnect() {
    logger.info('Disconnecting Constellation.');

    // Close and clear all subscriptions.
    ca.close();
    ca.subscriptions = {};

    // Set to not connected.
    constellationConnected = false;

    // Set connection status to online
    renderWindow.webContents.send('constellationConnection', "Offline");
}

// Constellation Status
// This will return if we're connected to constellation or not.
function getConstellationStatus() {
    return constellationConnected;
}

// Constellation Toggle
// Controls Turning on and off constellation when connection button is pressed.
ipcMain.on('mixerConstellation', function(event, status) {
    if (status === "connect" || status === "connected") {
        constellationConnect();
    } else {
        // Kill connection.
        constellationDisconnect();
    }
});

// Auth Process
// This kicks off the login process once refresh tokens are recieved.
ipcMain.on('gotConstellationRefreshToken', function() {
    constellationConnect();
});

// Export Functions
exports.connect = constellationConnect;
exports.disconnect = constellationDisconnect;
exports.getConstellationStatus = getConstellationStatus;