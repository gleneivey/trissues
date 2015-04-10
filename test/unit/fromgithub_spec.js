/*globals describe, it, beforeEach, afterEach, rewireInApp, loadJsonFixture, loadJsonFile */
/*jshint expr:true*/

var mitmFactory = require("mitm"),
    Promise = require("bluebird"),
    config = require("environmental").config(),
    mitm,

    projectId = 101,

// code under test
    fromGitHub = rewireInApp("fromGitHub");

describe("fromGitHub", function () {

  var emptyPromise = function () {
    var promiseResolver,
        promiseRejecter,
        promise = new Promise(function (resolver, rejecter) {
          promiseResolver = resolver;
          promiseRejecter = rejecter;
        });
    promise.resolve = function () {
      promiseResolver.apply(this, arguments);
      return promise;
    };
    promise.reject =  function () {
      promiseRejecter.apply(this, arguments);
      return promise;
    };

    return promise;
  };

  beforeEach(function () {
    fromGitHub.setConfig(config);
  });

  describe("#isIssueFromLabelChange", function () {
    it("returns true when a label is added", function () {
      fromGitHub.isIssueWithLabelChange(loadJsonFixture("githubWebhookLabelAdd")).should.be.true;
    });

    // it("returns true when a label is removed", function () {
    //   fromGitHub.isIssueWithLabelChange(loadJsonFixture("githubWebhookLabelRemove")).should.be.true;
    // });

    it("returns false for webhooks with non-label actions", function () {
      fromGitHub.isIssueWithLabelChange(loadJsonFixture("githubWebhookIssueClosed")).should.be.false;
    });
  });

  describe("#updateStoryLabelsInTracker", function () {
    beforeEach(function () {
      mitm = mitmFactory();
      config.tracker = { projectid: projectId };
    });

    afterEach(function () {
      mitm.disable();
    });

    it("Updates tracker if necessary", function (done) {
      var trackerSearchLinkedStory = loadJsonFile("trackerSearchLinkedStory"),
          storyId = 2208;

      mitm.on("request", function (req, res) {
        res.statusCode = 200;
        if (req.method === "GET") {
          if (req.url === "/services/v5/projects/" + projectId + "/search?query=external_id%3A2&envelope=true") {
            res.end(trackerSearchLinkedStory);
          } else {
            ("Unexpected url requested: " + req.url).should.equal(null);
          }
        } else if (req.method === "PUT") {
          req.url.should.equal("/services/v5/projects/" + projectId + "/stories/" + storyId + "?envelope=true");
          var accumulator = "",
              promise = emptyPromise();
          req.on("end", function () { promise.resolve(accumulator); });
          req.on('data', function(chunk) {
              accumulator += chunk.toString();
          });

          promise.then(function (body) {
            JSON.parse(body).should.eql({ labels: [{ id: 1234, name: "already there"}, { name: "help wanted" }] });
            var responseObj = { it: "worked" };
            res.end(JSON.stringify(responseObj));
          });
        } else {
          ("Should not be receiving a "+req.method+" request").should.equal(null);
        }
      });

      fromGitHub
          .updateStoryLabelsInTracker(loadJsonFixture("githubWebhookLabelAdd"))
          .then(function () { done(); });
    });

    it("Does not update tracker if unnecessary", function (done) {
      var trackerSearchLinkedStory = loadJsonFile("trackerSearchLinkedStory");

      mitm.on("request", function (req, res) {
        res.statusCode = 200;
        if (req.method === "GET") {
          if (req.url === "/services/v5/projects/" + projectId + "/search?query=external_id%3A2&envelope=true") {
            res.end(trackerSearchLinkedStory);
          } else {
            ("Unexpected url requested: " + req.url).should.equal(null);
          }
        } else {
          ("Should not be receiving a "+req.method+" request").should.equal(null);
        }
      });

      var githubWebhookJson = loadJsonFixture("githubWebhookLabelAdd");
      githubWebhookJson.label.name = "already there";
      fromGitHub
          .updateStoryLabelsInTracker(githubWebhookJson)
          .then(function () { done(); });
    });

    it("Does not update tracker if the label change in GitHub was made by TRIssues", function (done) {
      var trackerSearchLinkedStory = loadJsonFile("trackerSearchLinkedStory");

      mitm.on("request", function (req, res) {
        res.statusCode = 200;
        if (req.method === "GET") {
          if (req.url === "/services/v5/projects/" + projectId + "/search?query=external_id%3A2&envelope=true") {
            res.end(trackerSearchLinkedStory);
          } else {
            ("Unexpected url requested: " + req.url).should.equal(null);
          }
        } else {
          ("Should not be receiving a "+req.method+" request").should.equal(null);
        }
      });

      var githubWebhookJson = loadJsonFixture("githubWebhookLabelAdd");
      githubWebhookJson.label.name = "started";
      fromGitHub
          .updateStoryLabelsInTracker(githubWebhookJson)
          .then(function () { done(); });
    });
  });
});
