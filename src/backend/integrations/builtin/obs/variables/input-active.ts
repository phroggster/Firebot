import { ReplaceVariable } from "../../../../../types/variables";
import { getSourceActive } from "../obs-remote";

export const InputActiveVariable: ReplaceVariable = {
    definition: {
        handle: "obsInputActive",
        description: "Returns `true` if the OBS input is active or `false` if it is not.",
        examples: [
            {
                usage: "obsInputActive[sourceName]",
                description: "Gets a value indicating whether sourceName is presently active in OBS (connected, loaded, or playing, not neccessarily visible)."
            },
            {
                usage: "obsInputActive",
                description: "Gets a value indicating if the item that triggered the OBS event is active."
            }
        ],
        possibleDataOutput: ["bool"]
    },
    evaluator: async (trigger, ...args: unknown[]) => {
        if (args.length >= 1 && typeof args[0] === "string" && args[0] !== "") {
            return (await getSourceActive(args[0] as string)) ?? false;
        }
        const inputActive = trigger.metadata?.eventData?.inputActive;
        return inputActive ?? false;
    }
};
