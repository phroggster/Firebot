import { ReplaceVariable } from "../../../../../types/variables";
import { getSourceMuted } from "../obs-remote";

export const InputMutedVariable: ReplaceVariable = {
    definition: {
        handle: "obsInputMuted",
        description: "Returns `true` if the OBS input is muted or `false` if it is not.",
        examples: [
            {
                usage: "obsInputMuted[inputName]",
                description: "Gets a value indicating whether inputName is muted in OBS."
            },
            {
                usage: "obsInputMuted",
                description: "Gets a value indicating whether the input that triggered an OBS event is muted."
            }
        ],
        possibleDataOutput: ["bool"]
    },
    evaluator: async (trigger, ...args: unknown[]) => {
        if (args.length >= 1 && typeof args[0] === "string" && args[0] !== "") {
            return await getSourceMuted(args[0] as string);
        }
        const inputMuted = trigger.metadata?.eventData?.inputMuted;
        return inputMuted ?? false;
    }
};
