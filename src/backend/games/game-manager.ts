import frontendCommunicator from "../common/frontend-communicator";
import profileManager from "../common/profile-manager";
import { GameDefinition, GameManager, GameSettings, SettingsCategoryDefinition } from "../../types/games";

const getGameDb = () => profileManager.getJsonDbInProfile("/games");

type SettingsValues = {
    active?: boolean | null;
    settings?: Record<string, Record<string, { value: unknown }>>;
}
type SettingsCategories = {
    settings: Record<string, SettingsCategoryDefinition>;
}
type FirebotGame = GameDefinition & {
    settingsCategories: SettingsValues;
    active?: boolean | null;
};
type GameSettingsUpdateArgs = {
    activeStatus: boolean;
    gameId: string;
    settingCategories: SettingsCategories;
}

/** A dictionary of game id to settings object. */
let allGamesSettings: Record<string, GameSettings> = {};

const registeredGames: FirebotGame[] = [];

function buildGameSettings(game: FirebotGame, savedSettings: GameSettings|null): GameSettings {
    let settingsData: GameSettings = {
        active: game.active,
        settings: {}
    };

    if (savedSettings != null) {
        settingsData = savedSettings;
    }

    if (game.settingCategories) {
        for (const categoryId of Object.keys(game.settingCategories)) {
            if (settingsData.settings[categoryId] == null) {
                settingsData.settings[categoryId] = {};
            }
            for (const settingId of Object.keys(game.settingCategories[categoryId].settings)) {
                if (settingsData.settings[categoryId][settingId] === undefined) {
                    settingsData.settings[categoryId][settingId] = game.settingCategories[categoryId].settings[settingId].default;
                }
            }
        }
    }
    return settingsData;
}

function getGameSettingsFromValues(settingCategories: SettingsCategories, savedSettings: GameSettings): GameSettings {
    if (settingCategories && savedSettings) {
        for (const categoryId of Object.keys(settingCategories)) {
            for (const settingId of Object.keys(settingCategories[categoryId].settings)) {
                savedSettings.settings[categoryId][settingId] = settingCategories[categoryId].settings[settingId].value;
            }
        }
    }
    return savedSettings;
}

function saveAllGameSettings() {
    try {
        getGameDb().push("/", allGamesSettings);
    } catch {
    }
}

function setGameSettingValues(settingCategories: SettingsValues, savedSettings: GameSettings): SettingsValues {
    if (settingCategories && savedSettings) {
        for (const categoryId of Object.keys(settingCategories)) {
            for (const settingId of Object.keys(settingCategories[categoryId].settings)) {
                if (savedSettings.settings[categoryId]) {
                    settingCategories[categoryId].settings[settingId].value = savedSettings.settings[categoryId][settingId];
                }
            }
        }
    }
    return settingCategories;
}

function getGames() {
    return registeredGames.map((g) => {
        return {
            id: g.id,
            name: g.name,
            subtitle: g.subtitle,
            description: g.description,
            icon: g.icon,
            active: g.active,
            settingCategories: setGameSettingValues(g.settingCategories, buildGameSettings(g, allGamesSettings[g.id]))
        };
    });
}

function updateGameSettings(gameId: string, settingCategories: SettingsCategories|null, activeStatus: boolean|null) {
    const game = registeredGames.find(g => g.id === gameId);

    if (game == null) {
        return;
    }


    const previousSettings = buildGameSettings(game, allGamesSettings[game.id]);
    const previousActiveStatus = previousSettings.active;

    let gameSettings;
    if (settingCategories == null) {
        gameSettings = {
            active: false
        };

        game.active = false;

        delete allGamesSettings[game.id];
    } else {
        gameSettings = getGameSettingsFromValues(settingCategories, previousSettings);
        gameSettings.active = activeStatus === true;
        game.active = activeStatus === true;

        allGamesSettings[game.id] = gameSettings;
    }

    saveAllGameSettings();

    if (gameSettings.active) {
        //game has been enabled, load it
        if (previousActiveStatus === false && game.onLoad) {
            game.onLoad(gameSettings);
        } else if (game.onSettingsUpdate) {
            // just trigger settings update
            game.onSettingsUpdate(gameSettings);
        }
    } else {
        //game has been disabled, unload it
        if (previousActiveStatus === true && game.onUnload) {
            game.onUnload(gameSettings);
        }
    }
}

function getGameSettings<
    SettingsModel extends Record<string, Record<string, unknown>> = Record<string, Record<string, unknown>>
>(gameId: string): GameSettings<SettingsModel> {
    const game = registeredGames.find(g => g.id === gameId);
    if (!game) {
        return null;
    }
    return buildGameSettings(game, allGamesSettings[game.id]) as GameSettings<SettingsModel>;
}

function loadGameSettings(): void {
    try {
        const savedGameSettings = getGameDb().getData("/");
        if (savedGameSettings != null) {
            allGamesSettings = savedGameSettings;
        }
    } catch {
    }
}

function registerGame(game: GameDefinition): void {
    if (game == null) {
        return;
    }

    if (registeredGames.some(g => g.id === game.id)) {
        return;
    }

    const fbGame = game as FirebotGame;
    fbGame.active = false;

    let gameSettings = allGamesSettings[fbGame.id];
    if (gameSettings) {
        fbGame.active = gameSettings.active;
    } else {
        gameSettings = { active: false };
    }

    if (gameSettings.active && fbGame.onLoad) {
        fbGame.onLoad(gameSettings);
    }

    registeredGames.push(fbGame);
}



frontendCommunicator.onAsync('get-games', async () => {
    return getGames();
});

frontendCommunicator.on('game-settings-update', (data: GameSettingsUpdateArgs) => {
    const { gameId, settingCategories, activeStatus } = data;

    updateGameSettings(gameId, settingCategories, activeStatus);
});

frontendCommunicator.on('reset-game-to-defaults', (gameId: string) => {
    const game = registeredGames.find(g => g.id === gameId);

    if (game == null) {
        return;
    }

    updateGameSettings(gameId, null, null);

    frontendCommunicator.send("game-settings-updated", getGames());
});

export default <GameManager> {
    getGameSettings,
    loadGameSettings,
    registerGame
};
