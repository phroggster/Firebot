"use strict";

(function() {
    angular
      .module("firebotApp")
      .factory("hypeTrainService", function($timeout, backendCommunicator) {
          const service = {};

        service.hypeTrainActive = true;
          service.hypeTrainEnded = false;
        service.currentLevel = 3;
        service.currentProgressPercentage = 69;
          service.endsAt = new Date().toJSON();
        service.isGoldenKappaTrain = true;

          function updateHypeTrainState({ level, progressPercentage, endsAt, isGoldenKappaTrain }) {
            // service.currentLevel = level;
            // service.currentProgressPercentage = progressPercentage;
            // service.endsAt = endsAt;
            // service.hypeTrainActive = true;
            // service.hypeTrainEnded = false;
            // service.isGoldenKappaTrain = isGoldenKappaTrain;
          }

          backendCommunicator.on("hype-train:start", updateHypeTrainState);
          backendCommunicator.on("hype-train:progress", updateHypeTrainState);
          backendCommunicator.on("hype-train:end", () => {
              service.hypeTrainEnded = true;

              $timeout(() => {
                  service.hypeTrainActive = false;
                  service.hypeTrainEnded = false;
                  service.isGoldenKappaTrain = false;
              }, 5000);
          });

        return service;
    });
}());