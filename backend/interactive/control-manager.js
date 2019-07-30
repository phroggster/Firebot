"use strict";
const mixplayProjectManager = require("./mixplay-project-manager");

const effectManager = require("../effects/effectManager");
const effectRunner = require("../common/effect-runner");
const { TriggerType } = require("../common/EffectType");
const { settings } = require('../common/settings-access');
const userDatabase = require("../database/userDatabase.js");
const cooldownManager = require("./cooldown-manager");
const logger = require("../logwrapper");

function getConnectedProject() {
    const connectedProjectId = mixplayProjectManager.getConnectedProjectId();

    return mixplayProjectManager.getProjectById(connectedProjectId);
}

function getControlById(controlId, projectId) {
    let currentProject = mixplayProjectManager.getProjectById(projectId);
    if (currentProject) {
        let scenes = currentProject.scenes;
        if (scenes) {
            for (let scene of scenes) {
                if (scene.controls) {
                    for (let control of scene.controls) {
                        if (control.id === controlId) {
                            return control;
                        }
                    }
                }
            }
        }
    }
    return null;
}

async function handleInput(inputType, sceneId, inputData, participant) {
    const connectedProject = getConnectedProject();

    if (connectedProject == null) {
        return;
    }

    let control;
    for (const scene of connectedProject.scenes) {
        control = scene.controls.find(c => c.id === inputData.controlID);
        if (control != null) {
            break;
        }
    }

    if (!control) {
        return;
    }

    // Handle any cooldowns
    if (control.kind === "button" || control.kind === "textbox") {
        if (inputType !== "mouseup" && inputType !== "keyup") {
            const alreadyOnCooldown = cooldownManager.handleControlCooldown(control);
            if (alreadyOnCooldown) {
                logger.info("Control " + control.id + " is still on cooldown. Ignoring press.");
                return;
            }
        }
    }


    if (control.effects && control.effects.list) {
        let effectsForInputType = control.effects.list.filter(e => effectManager.effectSupportsInputType(e.type, inputType));

        if (effectsForInputType.length > 0) {
            let processEffectsRequest = {
                trigger: {
                    type: TriggerType.INTERACTIVE,
                    metadata: {
                        username: participant.username,
                        userId: participant.userID,
                        participant: participant,
                        control: control,
                        inputData: inputData,
                        inputType: inputType
                    }
                },
                effects: control.effects
            };

            // Increment Total Interactions for User in UserDB.
            if (inputType === "mousedown") {
                userDatabase.incrementDbField(
                    participant.userID,
                    "mixplayInteractions"
                );
            }

            effectRunner.processEffects(processEffectsRequest).catch(reason => {
                console.log("error when running effects: " + reason);
            });
        }
    }
}

exports.handleInput = handleInput;
exports.getControlById = getControlById;