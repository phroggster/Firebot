"use strict";

// Modal for adding or editting a command

(function() {
  angular.module("firebotApp").component("addOrEditTimerModal", {
    templateUrl:
      "./directives/modals/timers/addOrEditTimer/addOrEditTimerModal.html",
    bindings: {
      resolve: "<",
      close: "&",
      dismiss: "&",
      modalInstance: "<"
    },
    controller: function($scope, commandsService, utilityService, ngToast) {
      let $ctrl = this;

      $ctrl.timer = {
        active: true,
        onlyWhenLive: true,
        randomize: false,
        name: "",
        interval: 0,
        actions: []
      };

      $ctrl.$onInit = function() {
        if ($ctrl.resolve.timer == null) {
          $ctrl.isNewTimer = true;
        } else {
          $ctrl.timer = JSON.parse(JSON.stringify($ctrl.resolve.timer));
        }

        let modalId = $ctrl.resolve.modalId;
        $ctrl.modalId = modalId;
        utilityService.addSlidingModal(
          $ctrl.modalInstance.rendered.then(() => {
            let modalElement = $("." + modalId).children();
            return {
              element: modalElement,
              name: "Edit Timer",
              id: modalId,
              instance: $ctrl.modalInstance
            };
          })
        );

        $scope.$on("modal.closing", function() {
          utilityService.removeSlidingModal();
        });
      };

      $ctrl.actionListUpdated = function(actions) {
        $ctrl.timer.actions = actions;
      };

      $ctrl.delete = function() {
        if ($ctrl.timer) return;
        $ctrl.close({ $value: { timer: $ctrl.timer, action: "delete" } });
      };

      function validateTimer() {
        if ($ctrl.timer.name === "") {
          ngToast.create("Please provide a name for the Timer.");
          return false;
        } else if ($ctrl.timer.interval < 1) {
          ngToast.create("Timer interval must be greater than 0.");
          return false;
        } else if ($ctrl.timer.actions.length < 1) {
          ngToast.create("Please add at least one action to this timer.");
          return false;
        }
        return true;
      }

      $ctrl.save = function() {
        if (!validateTimer()) return;

        let action = $ctrl.isNewTimer ? "add" : "update";
        $ctrl.close({
          $value: {
            timer: $ctrl.timer,
            action: action
          }
        });
      };
    }
  });
})();
