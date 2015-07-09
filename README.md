# Getting started

```bash
npm install
npm run watch-js
# Then use something like static, or SimpleHTTPServer to serve the root directory and load up test.html
```

# Why?

The classic way of wrapping a none-framework specific javascript library into an angular app is to use a directive. Usually, during the link phase all DOM listeners will be attached to the elements involved. Then as lib does stuff you feed information back into the main angular app. This process works well for simple integrations, but often the needs of a developer aren't simple.

Once you move past simple it makes sense to build a js lib that is native to angular. This happened to the angular select2 plugin. An effort was started to wrap select2 as a directive, eventually they decided to write something like select2 that was native to angular. If you consider the amount of UI elements involved with a control like select2, and how particular angular is about UI code, it makes sense.

When I was trying to use the annotator in an angular project I felt like I was running into this mismatch problem. Where I was attempting to bend annotator into a shape that fits into angular. While it's not impossible to adapt annotator to work with angular, I think for certain kinds of integrations it would be easier if there was a version of annotator that was native to angular.

So, I wondered what that might look like and this is what I have come up with so far.

The first part is the binding of annotations. It uses the built in ngModel directive to connect the annotator to your apps model.

The second part is that all the UI, html, is rendered using angular in it's current shape it borrows the HTML almost verbatim, but it loads the templates, and renders them using the built in engine.

Finally, what I think you gain with this approach is extensibility in the angular sense. Annotator clearly has a lot of hooks, and is very extensible, but and I tried to embody that spirit with this port.

# Extensability

My approach to extensibility was to use angulars built in injector service to replace components. Every part of the app is built using services, and directives. By keeping things modular, an angular app developer has the ability to replace one of the components with one of their own making.

Here is an example app that use the defaults for everything, and stores the data in localStorage.

```js
angular.module('testApp', ['ngAnnotator'])
  .controller('testController', function ($scope) {
    $scope.annotations = localStorage.annotations && JSON.parse(localStorage.annotations) || [];
    console.log("testController: loaded", $scope.annotations);

    $scope.$watchCollection('annotations', function (newVal) {
      localStorage.annotations = JSON.stringify(newVal);
    });
  })
```

It would be hooked up to the HTML like so.

```html
<body ng-app='testApp' ng-controller='testController'>
  <div class='content' ng-annotator ng-model='annotations'>...</div>
</body>
```

A user would be able to make annotations on the content, and they would get persisted to localStorage. Simple. But, lets say you want to console.log something everytime an annotation view ctrl is instantiated. You could replace the built in annotation view controller with your own. So, the code would look like this

```js
angular.module('testApp', ['ngAnnotator'])
  .controller('testController', function ($scope) {
    $scope.annotations = localStorage.annotations && JSON.parse(localStorage.annotations) || [];
    console.log("testController: loaded", $scope.annotations);

    $scope.$watchCollection('annotations', function (newVal) {
      localStorage.annotations = JSON.stringify(newVal);
    });
  })
  .controller('viewAnnotationController', function ($scope, uiInstance, annotation) {
    console.log("see I changed the default", annotation);
    $scope.annotation = annotation;
    $scope.edit = function () {
      uiInstance.close('edit');
    };

    $scope.cancel = function () {
      uiInstance.close('delete');
    };

  })
```

Now, the app will the viewAnnotationController defined by the app and not the default.

Currently every part of the app is replaceable in this manner.

# Goals

As this is just a sketch, if I were going to continue with this project I would have a couple goals.

**Find a community**

Most importantly, I'd like to find some developers interested in using something like this, it would help to get feedback. I have a project that I am working on that could use this, but my app can't possibly represent all the needs a developer might have.

**Docuement Extensability**

At this time, the API that each component expoes is unclear, and each component sort of hapazardly exposes an API. A goal would be to create clear guides as to how to replace components.

**Finish the project**

As it stands it doesn't really work, a person could not use this, but I think it's close. I would borrow heavily from the exsisting annotator to fill the gaps, all while attempting to use only native angular components.

