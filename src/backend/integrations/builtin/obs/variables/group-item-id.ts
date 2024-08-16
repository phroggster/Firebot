import { ReplaceVariable } from "../../../../../types/variables";
import { getGroupItemByName } from "../obs-remote";

export const GroupItemIdVariable: ReplaceVariable = {
    definition: {
        handle: "obsGroupItemId",
        description:
            "The group-unique numeric ID of the item in OBS that triggered the event, or -1 when the item is not grouped.",
        examples: [
            {
                usage: "obsGroupItemId[itemName, groupName]",
                description: "Gets the group-unique numeric ID of the item named ItemName in the group named GroupName, or -1 if the item could not be found in the group."
            },
            {
                usage: "obsGroupItemId",
                description: "Gets the group-unique numeric ID of the item that triggered the OBS event, or -1 when the item is not grouped."
            }
        ],
        possibleDataOutput: ["number"]
    },
    evaluator: async (trigger, ...args: unknown[]) => {
        if (args.length >= 2 && args[0] && args[1] && args[0] !== "" && args[1] !== "") {
            const item = await getGroupItemByName(args[0] as string, args[1] as string);
            return item && item.id >= 0 ? item.id : -1;
        }
        const groupItemId = trigger.metadata?.eventData?.groupItemId;
        return groupItemId ?? -1;
    }
};
