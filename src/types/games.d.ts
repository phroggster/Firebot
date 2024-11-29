type DictDict = Record<string, Record<string, unknown>>;

type SettingType = "string" |
"number" |
"boolean" |
"enum" |
"filepath" |
"currency-select" |
"chatter-select" |
"editable-list" |
"role-percentages" |
"role-numbers";

/** A Firebot game setting definition. */
type SettingDefinition = {
    /** The type of setting, which determines the UI. */
    type: SettingType;
    /** Human-readable title. */
    title?: string;
    /** Human-readable description. */
    description?: string;
    /** Human-readable tip, which is rendered below the fields in smaller, muted text. */
    tip?: string;
    /** The default value that is initially set. */
    default?: unknown;
    /** A value to show as a placeholder in the UI. */
    placeholder?: string;
    /** A rank to tell the UI how to order settings. */
    sortRank?: number;
    /** Display a line under the setting. */
    showBottomHr?: boolean;
    /** Whether a text entry field should be used for the setting. */
    useTextArea?: boolean;
    /** Various validation properties. */
    validation?: {
        /** The min number value, if type is number. */
        min?: number;
        /** The max number value, if type is number. */
        max?: number;
        /** Whether or not a value is required before the user can save. */
        required?: boolean;
    };
};

/** A setting category definition which holds a dictionary of settings definitions. */
type SettingsCategoryDefinition = {
    /** Human-readable title. */
    title: string;
    /** The settings definition dictionary. */
    settings: Record<string, SettingDefinition>;
    /** Human-readable definition. */
    description?: string;
    /** A rank to tell the UI how to order settings. */
    sortRank?: number;
};

/** All settings data saved for the game. */
export type GameSettings<TSettings extends DictDict = DictDict> = {
    /** If the game has been enabled by the user. */
    active?: boolean|null;
    /** Dictionary of dictionaries containing game settings saved by the user. */
    settings?: TSettings;
};

// TODO: templatize this for game settings validation
export type GameDefinition = {
    /** Unique id for the game */
    id: string;
    /** Human-readable name for the game */
    name: string;
    /** Very short tagline for the game, shows up in the games tab */
    subtitle: string;
    /** Verbose description of the game, shown when clicking edit on the game */
    description: string;
    /** Font Awesome 5 icon to use for the game, ie 'fa-dice-three' */
    icon: string;
    /** Definitions of setting categories and the settings within them */
    settingCategories: Record<string, SettingsCategoryDefinition>;

    /** Called when the game is enabled, either on app load or if the user enables the game later.
     * You can register a system command here or set up any required game state. */
    onLoad: (gameSettings: GameSettings) => void;
    /** Called when the game was previously active but has since been disabled. You should
     * unregister any system commands here and clear out any game state.
     */
    onUnload: (gameSettings: GameSettings) => void;
    /** Called whenever the settings from settingCategories are updated by the user. */
    onSettingsUpdate: (gameSettings: GameSettings) => void;
};

export interface GameManager {
    /** Get the settings for a Firebot game. */
    getGameSettings: <TSettings extends DictDict = DictDict>(game: string) => GameSettings<TSettings>;
    /** Load the game settings database from disk during application startup.
     * @private FIUO: *NOT* to be exposed to third-party scripts.
     */
    loadGameSettings: () => void;
    /** Register a Firebot game. */
    registerGame: (game: GameDefinition) => void;
}
