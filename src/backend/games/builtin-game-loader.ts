import gameManager from "./game-manager";
import bidUtil from "./builtin/bid/bid";
import slotsGame from "./builtin/slots/slots";
import triviaGame from "./builtin/trivia/trivia";

export default {
    loadGames: () => {
        [
            bidUtil,
            // TODO: heistGame
            slotsGame,
            triviaGame
        ].forEach((game) => {
            gameManager.registerGame(game);
        });
    }
};
