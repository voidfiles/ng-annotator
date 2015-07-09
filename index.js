'use strict';

var Range = require('xpath-range').Range;
var $ = require('jquery');
var angular = require('angular');
var TextSelector = require('./src/textselector').TextSelector;
var ngAnnotator = angular.module('ngAnnotator', []);
var Highlighter = require('./src/highlighter').Highlighter;
var NS = 'annotator-view';

ngAnnotator.service('AnnotationStore', function () {

  var AnnotationStore = function () {
    this.id = 0;
    this.annotationsById = {};
    this.onUpdateCallbacks = [];
  };

  AnnotationStore.prototype.onUpdate = function (cb) {
    this.onUpdateCallbacks.push(cb);
  };

  AnnotationStore.prototype.getId = function () {
    this.id ++;
    return this.id;
  };

  AnnotationStore.prototype.all = function () {
    return this.annotationsById;
  };

  AnnotationStore.prototype.export = function () {
    var annotations = [];
    angular.forEach(this.annotationsById, function (val) {
      var localCopy = angular.merge({}, val);
      if (localCopy._local) {
        delete localCopy._local;
      }
      annotations.push(localCopy);
    });

    return annotations;
  };

  AnnotationStore.prototype.get = function (key) {
    return this.annotationsById[key];
  };

  AnnotationStore.prototype.set = function (val) {
    var id = this.getId();
    this.annotationsById[id] = val;
    val.id = id;
    return this.annotationsById[id];
  };

  AnnotationStore.prototype.update = function (annotation) {
    if (!this.annotationsById[annotation.id]) {
      return annotation;
    }
    angular.merge(this.annotationsById[annotation.id], annotation);

    angular.forEach(this.onUpdateCallbacks, function (cb) {
      cb(annotation);
    });

    return this.annotationsById[annotation.id];
  };

  AnnotationStore.prototype.setMany = function (annotations) {
    var _this = this;

    angular.forEach(annotations, function (annotation) {
      var id = annotation.id || _this.getId();
      annotation.id = id;
      _this.annotationsById[id] = annotation;
    });

    return this.all();
  };

  return AnnotationStore;

});

ngAnnotator.service('movableAnnotationUI', function ($q, $rootScope, $controller, $document, $compile, $templateRequest) {
  var ui = {};
  var mainPromise;
  var body = $document.find('body').eq(0);

  var removeUI = function () {
    if (ui.domEl) {
      ui.domEl.remove();
      delete ui.domEl;
    }

    if (ui.scope) {
      ui.scope.$destroy();
      delete ui.scope;
    }
  };

  var getUI = function (position, deferred, template, controller, annotation) {

    //prepare an instance of a modal to be injected into controllers and returned to a caller
    ui = {
      result: deferred.promise,
      close: function (result) {
        removeUI(ui);
        return deferred.resolve(result);
      },
      dismiss: function (reason) {
        removeUI(ui);
        return deferred.reject(reason);
      }
    };

    var ctrlInstance, ctrlLocals = {};

    ctrlLocals.$scope = ui.scope = $rootScope.$new(true);
    ctrlLocals.uiInstance = ui;
    ctrlLocals.annotation = annotation;

    ctrlInstance = $controller(controller, ctrlLocals);

    var angularDomEl = angular.element(template);
    var domEl = ui.domEl = $compile(angularDomEl)(ctrlLocals.$scope);

    body.append(domEl);
    domEl.css({
        top: position.top,
        left: position.left
    });

    return ui;

  };

  return function (position, templateUrl, controller, annotation) {
    var deferred = $q.defer();

    if (mainPromise) {
      mainPromise.reject();
    }

    if (ui) {
      removeUI();
    }

    return $templateRequest(templateUrl).then(function (template) {
      getUI(position, deferred, template, controller, annotation);

      mainPromise = deferred;
      return deferred.promise;
    });
  };
});

ngAnnotator.controller('createHighlightController', function ($scope, uiInstance) {
  $scope.ignoreMouseup = false;

  $scope.selection = function (selection) {
    uiInstance.close(selection);
    $scope.ignoreMouseup = false;
  };

  $scope.cancel = function () {
    uiInstance.dismiss();
  };

  $scope.mouseDown = function (event) {
    event.preventDefault();
    $scope.ignoreMouseup = true;
  };

  $scope.mouseUp = function (event) {
    if ($scope.ignoreMouseup) {
      event.stopImmediatePropagation();
    }
  };


});


ngAnnotator.service('createHighlight', function (movableAnnotationUI) {

  return function (position) {
    return movableAnnotationUI(position, 'src/templates/createAnnotation.html', 'createHighlightController');
  };
});

ngAnnotator.directive('ngAnnotator', function ($q, $compile, createHighlight, AnnotationStore) {
  var highlighter;

  function annotationFactory(contextEl, ignoreSelector) {
      return function (ranges) {
          var text = [],
              serializedRanges = [];

          for (var i = 0, len = ranges.length; i < len; i++) {
              var r = ranges[i];
              text.push($.trim(r.text()));
              serializedRanges.push(r.serialize(contextEl, ignoreSelector));
          }

          return {
              quote: text.join(' / '),
              ranges: serializedRanges
          };
      };
  }

  function mousePosition(event) {
      var body = global.document.body;
      var offset = {top: 0, left: 0};

      if ($(body).css('position') !== 'static') {
          offset = $(body).offset();
      }

      return {
          top: event.pageY - offset.top,
          left: event.pageX - offset.left
      };
  }

  return {
      restrict: 'EA',
      require: '^ngModel',
      link: function(scope, iElement, iAttrs, ngModelCtrl) {
        console.group('ngAnnotator directive link');
        highlighter = new Highlighter(iElement[0]);

        scope.annotationStore = new AnnotationStore();

        scope.annotationStore.setMany(ngModelCtrl.$modelValue || []);

        scope.annotationCtrollers = [];

        var registerAnnotation = function (annotation, annotationScope) {
          annotation = scope.annotationStore.set(annotation);
          scope.annotationCtrollers[annotation.id] = annotationScope;
          return annotation;
        };

        var updateViewValue = function () {
          ngModelCtrl.$setViewValue(scope.annotationStore.export());
        };

        scope.annotationStore.onUpdate(updateViewValue);

        ngModelCtrl.$render = function() {
          scope.annotationStore.setMany(ngModelCtrl.$modelValue || []);

          angular.forEach(scope.annotationStore.all(), function (annotation) {
            var results = highlighter.draw(annotation);
            var first = results[0];

            if ($(first).attr('annotation-start') !== undefined) {
              return;
            }

            var last = results[results.length - 1];
            $(first).attr('annotation-start', '1');
            $(last).attr('annotation-end', '2');
            var childScope = scope.$new();
            annotation = registerAnnotation(annotation, childScope);
            childScope.annotation = annotation;
            $compile(results)(childScope);
          });
        };

        var callMethodOnAnnotation = function (el, method, position) {
            var annotation = el.data('annotation');
            return scope.annotationCtrollers[annotation.id][method](position);
        };

        var makeAnnotation = annotationFactory(iElement[0], '.annotator-hl');

        $(iElement)
          .on('mouseover.' + NS, '[data-annotation]', function (ev) {
            callMethodOnAnnotation($(this), 'viewAnnotation', mousePosition(ev));
          })
          .on('mouseleave.' + NS, '[data-annotation]', function (ev) {
            callMethodOnAnnotation($(this), 'hideAnnotation', mousePosition(ev));
          });

        var textSelector = new TextSelector(iElement[0], {
          onSelection: function (ranges, event) {
              if (!ranges.length) {
                return false;
              }
              var annotation = makeAnnotation(ranges);
              var interactionPoint = mousePosition(event);
              createHighlight(interactionPoint).then(function () {
                var results = highlighter.draw(annotation);
                var first = results[0];
                var last = results[results.length - 1];
                $(first).attr('annotation-start', '1');
                $(last).attr('annotation-end', '2');
                var childScope = scope.$new();
                annotation = registerAnnotation(annotation, childScope);
                childScope.annotation = annotation;
                $compile(results)(childScope);
                childScope.editAnnotation(interactionPoint);
              });
          }
        });

        scope.$on('$destroy', function () {
          textSelector.destroy();
        });

        console.log('ngAnnotator directive link done');
      }
  };
});

ngAnnotator.controller('editAnnotationController', function ($scope, uiInstance, annotation) {
  $scope.annotation = annotation;

  $scope.save = function () {
    uiInstance.close($scope.annotation);
  };

  $scope.cancel = function () {
    uiInstance.dismiss();
  };
});

ngAnnotator.service('editAnnotation', function (movableAnnotationUI) {
  return function (position, annotation) {
    return movableAnnotationUI(position, 'src/templates/editAnnotation.html', 'editAnnotationController', annotation);
  };
});

ngAnnotator.controller('viewAnnotationController', function ($scope, uiInstance, annotation) {
  $scope.annotation = annotation;

  $scope.edit = function () {
    uiInstance.close('edit');
  };

  $scope.cancel = function () {
    uiInstance.close('delete');
  };

});

ngAnnotator.service('viewAnnotation', function (movableAnnotationUI) {

  return function (position, annotation) {
    return movableAnnotationUI(position, 'src/templates/viewAnnotation.html', 'viewAnnotationController', annotation);
  };
});

ngAnnotator.controller('annotationController', function ($scope, viewAnnotation, editAnnotation) {

  $scope.viewAnnotation = function (position) {
    return viewAnnotation(position, $scope.annotation).then(function (action) {
      if (action === 'edit') {
        return $scope.editAnnotation(position);
      }

      return $scope.annotation;
    });
  };

  $scope.editAnnotation = function (position) {
    return editAnnotation(position, $scope.annotation).then(function (annotation) {
      $scope.annotation = $scope.annotationStore.update(annotation);

      return $scope.viewAnnotation(position);
    });
  };

  $scope.hideAnnotation = function () {

  };
});

ngAnnotator.directive('annotation', function () {
  return {
      restrict: 'EA',
      controller: 'annotationController',
      multiElement: true,
      link: function(scope, iElement) {
        $(iElement).attr('data-annotation', scope.annotation.id);

      }
  };
});
