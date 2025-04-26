"use strict";

/**
 * @typedef {Object} MetadataPropDetails
 * @prop {string|null} [anonValue] The "default" value of the property when it is anonymous.
 * @prop {string|null} [anonWhen] The name of the metadata property that decides whether it is anonymous.
 * @prop {string|Array<string>} [duplicates] The name(s) of the property/ies that this prop will be mirrored over.
 * @prop {string|null} [description] A markdown-formattable description of the property, or what it should be used for.
 */
/**
 * @typedef {Object} Metadata
 * @prop {string} key
 * @prop {string} title
 * @prop {string} [description]
 * @prop {string} type
 * @prop {any} value
 * @prop {Object} [options]
 */
/**
 * @typedef {Object} EventData
 * @prop {string} eventId
 * @prop {string} sourceId
 * @prop {Object} metadata
 */
/**
 * @typedef {Object} SimulateEventsControl
 * @prop {Array<Metadata>} metadata
 * @prop {Object} manualMetadata
 * @prop {EventData} eventData
 * @prop {Record<string, MetadataPropDetails>} [metadataDetails]
 * @prop {boolean} eventError
 * @prop {Array<string>} [watchedProps]
 * @prop {boolean} hasPreviousProperties
 */

(function() {
    angular.module("firebotApp")
        .component("simulateGroupEventsModal", {
            template: `
                <div class="modal-header">
                    <button type="button" class="close" ng-click="$ctrl.dismiss()"><span>&times;</span></button>
                    <h4 class="modal-title">Simulate Event</h4>
                </div>
                <div class="modal-body">
                    <p class="muted">Select an event to simulate to test any effects you have saved.</p>
                    <div class="form-group" ng-class="{'has-error': $ctrl.eventError}">
                        <label class="control-label">Event</label>
                        <searchable-event-dropdown
                            selected="{ eventId: $ctrl.event.eventId, sourceId: $ctrl.event.sourceId }"
                            style="width:100%"
                            update="$ctrl.eventChanged(event)"
                        ></searchable-event-dropdown>
                    </div>

                    <div ng-if="$ctrl.metadata">
                        <command-option
                            ng-repeat="data in $ctrl.metadata | filter: simulateEventDuplicatedProperties(data.key, $ctrl.metadataDetails)"
                            name="data.title"
                            metadata="data"
                            ng-attr-uib-collapse="$ctrl.isCollapsedAnonymously(data.key)"
                            watch-props="$ctrl.watchedProps"
                            on-update="$ctrl.onPropUpdated(key, value)"
                        ></command-option>
                    </div>

                </div>
                <div class="modal-footer">
                    <button ng-if="$ctrl.hasPreviousProperties" type="button" class="btn btn-default pull-left" ng-click="$ctrl.loadPrevious()">Load Previous</button>
                    <button type="button" ng-disabled="$ctrl.eventData.eventId == null" class="btn btn-primary" ng-click="$ctrl.simulate()">Simulate</button>
                </div>
            `,
            bindings: {
                resolve: "<",
                close: "&",
                dismiss: "&"
            },
            controller: function(backendCommunicator, ngToast, simulatedEventsCache) {
                /** @type {SimulateEventsControl} */
                const $ctrl = this;

                $ctrl.metadata = [];
                $ctrl.manualMetadata = {};
                $ctrl.eventData = {
                    eventId: null,
                    sourceId: null,
                    metadata: {}
                };
                $ctrl.metadataDetails = null;
                $ctrl.eventError = false;
                $ctrl.watchedProps = null;

                $ctrl.hasPreviousProperties = false;

                /** @obsolete */
                $ctrl.anonEvents = {
                    'community-subs-gifted': {
                        'gifterUsername': 'An Anonymous Gifter'
                    },
                    'subs-gifted': {
                        'gifterUsername': 'An Anonymous Gifter',
                        'username': 'ananonymousgifter'
                    }
                };

                /** Get a value indicating whether this input field should be hidden.
                 * @param {string} key
                 */
                $ctrl.isCollapsedAnonymously = (key) => {
                    // TODO: re-write this to use metadataDetails
                    if (key && $ctrl.eventData?.eventId && $ctrl.eventData.eventId in $ctrl.anonEvents
                        && key in $ctrl.anonEvents[$ctrl.eventData.eventId]
                    ) {
                        return $ctrl.metadata.find(md => md.key === 'isAnonymous')?.value === true;
                    }
                    return false;
                };

                /** A watched metadata value was modified.
                 * @param {string} key
                 * @param {any} value
                 */
                $ctrl.onPropUpdated = (key, value) => {
                    if (!key) {
                        debugger;
                    }
                    if (!$ctrl.eventData || !$ctrl.metadataDetails) {
                        return;
                    }

                    // if (!$ctrl.eventData.eventId || !Object.keys($ctrl.anonEvents).includes($ctrl.eventData.eventId)) {
                    //     return;
                    // }
                    //
                    // for (const keyName of Object.keys($ctrl.anonEvents[$ctrl.eventData.eventId])) {
                    //     const metaIdx = $ctrl.metadata.findIndex(md => md.key === keyName);
                    //     if (metaIdx < 0) {
                    //         continue;
                    //     }
                    //
                    //     if (isAnon.value === true) {
                    //         $ctrl.metadata[metaIdx].value = $ctrl.anonEvents[$ctrl.eventData.eventId][keyName];
                    //     } else if ($ctrl.manualMetadata && keyName in $ctrl.manualMetadata) {
                    //         $ctrl.metadata[metaIdx].value = $ctrl.manualMetadata[keyName];
                    //     }
                    // }

                    const details = Object.keys($ctrl.metadataDetails)
                        .filter(mddKey => $ctrl.metadataDetails[mddKey].anonWhen?.includes(key))
                        .map(mddKey => ({k: mddKey, v: $ctrl.metadataDetails[mddKey]}));
                    if (details.length < 1) {
                        return;
                    }

                    // TODO: (?eval? anonWhen given current metadata) ? (apply metadataDetails.anonValue) : (apply manualMetadata.value)
                    // and come up with some better prop names names to extend this all to any additional use cases
                    // what use cases?
                };

                /**
                 * @param {string} metadata
                 * @param {string} eventId
                 */
                const getTitle = (metadata, eventId) => {
                    // TODO: metadataDetails should be used instead
                    if (metadata === 'gifterUsername' && (eventId === 'community-subs-gifted' || eventId === 'gift-sub-upgraded' || eventId === 'subs-gifted')) {
                        return "Gifter Display Name";
                    } else if (metadata === 'gifteeUsername' && eventId === 'gift-sub-upgraded') {
                        return "Giftee Display Name";
                    }
                    const titleArray = metadata.split(/(?=[A-Z])/);

                    const capitalized = titleArray.map(word => word.charAt(0).toUpperCase() + word.slice(1, word.length));
                    return capitalized.join(" ");
                };

                /**
                 * @param {EventData} event
                 */
                $ctrl.eventChanged = async (event) => {
                    $ctrl.eventData.eventId = event.eventId;
                    $ctrl.eventData.sourceId = event.sourceId;
                    $ctrl.eventData.metadata = {};

                    $ctrl.hasPreviousProperties = simulatedEventsCache.hasPreviouslySimulatedEvent(
                        event.sourceId,
                        event.eventId
                    );

                    const eventSource = await backendCommunicator.fireEventAsync("getEventSource", event);
                    if (eventSource.someSillyNameThatICantThinkOfToDescribeThis) {
                        /** @type {Record<string, MetadataPropDetails>} */
                        const mdd = eventSource.someSillyNameThatICantThinkOfToDescribeThis;
                        /** @type {Set<string>} */
                        const watched = new Set();
                        for (const mdKey of Object.keys(mdd).filter(mdk => mdd[mdk].anonWhen)) {
                            watched.add(mdd[mdKey].anonWhen);
                        }
                        if (watched.size > 0) {
                            $ctrl.watchedProps = [...watched];
                        } else {
                            $ctrl.watchedProps = null;
                        }
                        $ctrl.metadataDetails = mdd;
                    } else {
                        $ctrl.metadataDetails = null;
                        $ctrl.watchedProps = null;
                    }
                    if (eventSource.manualMetadata) {
                        $ctrl.manualMetadata = eventSource.manualMetadata;
                        $ctrl.metadata = Object.keys(eventSource.manualMetadata).map((mmd) => {
                            const meta = eventSource.manualMetadata[mmd];
                            const dataType = meta == null ? "string" : meta.type || typeof meta;
                            const data = {
                                key: mmd,
                                title: getTitle(mmd, event.eventId),
                                description: eventSource.someSillyNameThatICantThinkOfToDescribeThis && mmd in eventSource.someSillyNameThatICantThinkOfToDescribeThis
                                    ? eventSource.someSillyNameThatICantThinkOfToDescribeThis[mmd]?.description ?? null : null,
                                type: dataType,
                                value: dataType !== "enum" ? (meta.value ?? meta) : undefined,
                                options: meta?.options || {}
                            };

                            return data;
                        });
                    } else {
                        $ctrl.metadata = [];
                    }
                };

                $ctrl.loadPrevious = () => {
                    if (!simulatedEventsCache.hasPreviouslySimulatedEvent(
                        $ctrl.eventData.sourceId,
                        $ctrl.eventData.eventId
                    )) {
                        return;
                    }

                    const previousProperties = simulatedEventsCache.getPreviouslySimulatedEventProperties(
                        $ctrl.eventData.sourceId,
                        $ctrl.eventData.eventId
                    );

                    $ctrl.metadata.forEach((md) => {
                        const previousValue = previousProperties[md.key];
                        if (previousValue != null) {
                            md.value = previousValue;
                        }
                    });
                };

                $ctrl.simulate = () => {
                    $ctrl.eventError = false;

                    if ($ctrl.eventData.sourceId == null) {
                        $ctrl.eventError = true;
                        return;
                    }

                    if ($ctrl.metadata.length > 0) {
                        $ctrl.metadata.forEach(md => $ctrl.eventData.metadata[md.key] = md.value);
                    }
                    if ($ctrl.metadataDetails) {
                        for (const mdKey of Object.keys($ctrl.metadataDetails).filter(mdk => $ctrl.metadataDetails[mdk].duplicates)) {
                            const dupes = Array.isArray($ctrl.metadataDetails[mdKey].duplicates)
                                ? $ctrl.metadataDetails[mdKey].duplicates
                                : $ctrl.metadataDetails[mdKey].duplicates?.split(' ');
                            dupes?.forEach(dupe => $ctrl.eventData.metadata[dupe] = $ctrl.metadata[mdKey]);
                        }
                    }

                    simulatedEventsCache.setSimulatedEventProperties(
                        $ctrl.eventData.sourceId,
                        $ctrl.eventData.eventId,
                        $ctrl.eventData.metadata
                    );

                    backendCommunicator.fireEventSync("simulateEvent", $ctrl.eventData);
                    ngToast.create({
                        className: 'success',
                        content: "Event simulated!"
                    });
                    $ctrl.close();
                };
            }
        })
        .filter("simulateEventDuplicatedProperties", function() {
            /** Filter out any manual metadata properties that will get duplicated from another.
             * @param {string} key The unique name of the manual metadata property being checked.
             * @param {Record<string, MetadataPropDetails>} metadataDetails The event's extended
             * `someSillyNameThatICantThinkOfToDescribeThis` object.
            */
            return function(key, metadataDetails) {
                if (key == null) {
                    return false;
                } else if (metadataDetails == null) {
                    return true;
                }
                for (const prop of Object.keys(metadataDetails)) {
                    if (!("duplicates" in metadataDetails[prop]) || metadataDetails[prop].duplicates == null) {
                        continue;
                    }
                    const dupes = metadataDetails[prop].duplicates;
                    if (dupes === key || Array.isArray(dupes) && dupes.some(dupe => dupe === key)) {
                        return false;
                    }
                }
                return true;
            };
        });
}());
