import { ReplaceVariable } from "../../../../types/variables";
import { OutputDataType, VariableCategory } from "../../../../shared/variable-constants";
import activeUserHandler from "../../../chat/chat-listeners/active-user-handler";
import logger from "../../../logwrapper";
import { getRoleByName, userIsInRole } from "../../../roles/custom-roles-manager";
import { getRandomInt } from "../../../utility";

const model : ReplaceVariable = {
    definition: {
        handle: "randomViewer",
        description: "Get a random viewer's username that is presently in your channel's chat.",
        categories: [VariableCategory.USER],
        possibleDataOutput: [OutputDataType.TEXT, OutputDataType.OBJECT],
        examples: [
            {
                usage: "randomViewer[rolesToInclude, usersToExclude, customRolesToExclude, username|displayName|id|raw]",
                description: "Get a random online viewer that is a member of the custom role(s), ignoring the excluded username(s) and members in the excluded role(s)."
            },
            {
                usage: "randomViewer[roleOne, $streamer, null, displayName]",
                description: "Get a random online viewer's display name that is a member of the roleOne custom role, excluding your own user name."
            },
            {
                usage: "randomViewer[null, ebiggz, roleC, id]",
                description: "Get a random online viewer's unique user id, excluding ebiggz, and excluding any members of the roleC custom role."
            },
            {
                usage: "randomViewer[$arrayFrom[roleOne, roleTwo], $arrayFrom[$streamer, $bot], $arrayFrom[roleC, roleD]]",
                description: "Filter to members of roleOne or roleTwo, excluding your own streamer and bot accounts, and excluding any members of roleC or roleD."
            },
            {
                usage: "randomViewer[null, null, null, raw]",
                description: "Get an object representing an online viewer. The result will include `username`, `displayName` and `id` properties."
            }
        ]
    },
    evaluator: (_, roles: string | string[], ignoreUsers?: string | string[], ignoreRoles?: string | string[], propName?: string) => {
        const failResult = "[Unable to get random viewer]";
        logger.debug("Getting random viewer...");

        const onlineViewerCount = activeUserHandler.getOnlineUserCount();

        if (onlineViewerCount === 0) {
            logger.warn("randomViewer: no online viewers are available to select from");
            return failResult;
        }

        function parseArg(param?: string | string[]): string[] {
            if (param != null) {
                if (Array.isArray(param)) {
                    return [...new Set(param)]; // defensive de-duplication
                } else if (typeof param === "string" && param.toLowerCase() !== "null") {
                    return [param];
                }
            }
            return [];
        }

        const excludedUserNames = parseArg(ignoreUsers);
        const excludedRoleNames = parseArg(ignoreRoles);
        // Trim out any roles that were both included and excluded
        const includedRoleNames = parseArg(roles)
            .filter(roleName => !excludedRoleNames.includes(roleName));

        const includedRoles = includedRoleNames
            .map(roleName => getRoleByName(roleName))
            .filter(role => role != null);
        if (includedRoleNames.length > includedRoles.length) {
            // warn and return early if /all/ included roles are unknown
            if (includedRoles.length === 0) {
                logger.warn(`randomViewer filtering solely to unknown role(s): ${includedRoleNames.join(", ")}`);
                return "[Unable to get random active user]";
            }
            // otherwise, warn if any roles are unknown
            const unknownRoleNames = includedRoleNames
                .filter(roleName => !includedRoles.some(role => role.name.toLowerCase() === roleName.toLowerCase()));
            logger.warn(`randomViewer ignoring unknown included role(s): ${unknownRoleNames.join(", ")}`);
        }

        const excludedRoles = excludedRoleNames
            .map(roleName => getRoleByName(roleName))
            .filter(role => role != null);
        if (excludedRoleNames.length > excludedRoles.length) {
            const unknownRoleNames = excludedRoleNames
                .filter(roleName => !excludedRoles.some(role => role.name.toLowerCase() === roleName.toLowerCase()));
            logger.warn(`randomViewer ignoring unknown excluded role(s): ${unknownRoleNames.join(", ")}`);
        }

        let selectableUsers = activeUserHandler.getAllOnlineUsers();
        if (excludedUserNames.length > 0) {
            selectableUsers = selectableUsers.filter(user => !excludedUserNames.includes(user.username));
        }

        // TODO: Twitch role names *are* available for use here...
        if (excludedRoles.length > 0) {
            const excludedRoleIds = excludedRoles.map(role => role.id);
            selectableUsers = selectableUsers.filter(user => !userIsInRole(user.id, [], excludedRoleIds));
        }
        if (includedRoles.length > 0) {
            const includedRoleIds = includedRoles.map(role => role.id);
            selectableUsers = selectableUsers.filter(user => userIsInRole(user.id, [], includedRoleIds));
        }

        if (selectableUsers.length > 0) {
            const randIndex = getRandomInt(0, selectableUsers.length - 1);
            const winner = selectableUsers[randIndex];
            switch (propName?.toLowerCase()) {
                case "displayname":
                    return winner.displayName;
                case "id":
                    return winner.id;
                case "raw":
                    return {
                        displayName: winner.displayName,
                        id: winner.id,
                        username: winner.username
                    };
                default:
                case "username":
                    return winner.username;
            }
        }

        logger.warn(`randomViewer failed to get a user; +${onlineViewerCount}/-${
            excludedUserNames.length} viewers, +${includedRoles.length}/-${excludedRoles.length} roles`);
        return failResult;
    }
};

export default model;
