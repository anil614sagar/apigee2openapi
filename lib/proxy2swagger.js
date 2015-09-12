var fs = require('fs');
var xml2js = require('xml2js');
var url = require('url');


module.exports = {
  genSwagger: genSwagger
}

function genSwagger(location, answers, cb) {
  var swaggerJson = {};
  loadXMLDoc(location + "/apiproxy/" + answers.api + ".xml", function(err, reply) {
    swaggerJson.swagger = "2.0";
    // Info Section
    swaggerJson.info = {};
    try {
      swaggerJson.info.description = reply.APIProxy.Description ? reply.APIProxy.Description[0] : '';
      swaggerJson.info.version = (reply.APIProxy.$.revision || "1") + ".0.0";
      swaggerJson.info.title = reply.APIProxy.DisplayName ? reply.APIProxy.DisplayName[0] : answers.api;
      swaggerJson.info.contact = {}
      swaggerJson.info.contact.email = reply.APIProxy.CreatedBy[0] || '';
    } catch (ex) {console.log(ex)}
    // Host & BasePath Section..
    var proxy = url.parse(answers.proxyEndPoint);
    swaggerJson.host = proxy.host ? proxy.host : '';
    var schemes = [];
    var protocol = proxy.protocol ? proxy.protocol : 'http';
    schemes.push(protocol.substring(0, protocol.length -1));
    swaggerJson.schemes = schemes;
    loadXMLDoc(location + "/apiproxy/proxies/default.xml", function(err, replyProxy) {
      // Add base path
      try {
        swaggerJson.basePath = replyProxy.ProxyEndpoint.HTTPProxyConnection[0].BasePath[0];
      } catch (ex) {console.log(ex);}

      // Add Paths
      swaggerJson.paths = {};
      for (key in replyProxy.ProxyEndpoint.Flows[0].Flow) {
        var swaggerPath = JSON.parse(JSON.stringify(replyProxy.ProxyEndpoint.Flows[0].Flow[key]));;
        if (swaggerPath["Condition"] != null) {
          var flowCondition = swaggerPath["Condition"].pop();
          // Get Path & Verb...
          var rxVerb = /request.verb = "(.*?)"/g;
          var rxPath = /proxy.pathsuffix MatchesPath "(.*?)"/g;
          var verbArr = rxVerb.exec(flowCondition);
          var pathArr = rxPath.exec(flowCondition);
          if (verbArr != null && pathArr != null) {
            var resourcePath = pathArr[1];
            var resourceVerb = verbArr[1].toLowerCase();
            swaggerJson.paths[resourcePath] = {};
            swaggerJson.paths[resourcePath][resourceVerb] = {};
            swaggerJson.paths[resourcePath][resourceVerb].operationId = swaggerPath.$.name;
            if (swaggerPath.Description != null) {
              swaggerJson.paths[resourcePath][resourceVerb].summary = swaggerPath.Description[0];
            }
            var resourceResponse = {
              "200": {
                "description": "successful operation"
              }
            };
            swaggerJson.paths[resourcePath][resourceVerb].responses = resourceResponse;
            // Add parameters if path includes dynamic value....
            var rxParam = /\{(.*?)\}/g;
            var rxParamArr = pathArr[1].match(rxParam);
            if (rxParamArr != null) {
              // Add Parameters
              swaggerJson.paths[resourcePath][resourceVerb].parameters = [];
              for (var i in rxParamArr) {
                var resourceParameter = rxParamArr[i];
                var rxResourceParameter = /\{(.*?)\}/g;
                var resourceParameterArr = rxResourceParameter.exec(resourceParameter);
                var parameterObj = {
                  name: resourceParameterArr[1],
                  in: 'path',
                  required: true,
                  type: 'string'
                };
                swaggerJson.paths[resourcePath][resourceVerb].parameters.push(parameterObj);
              }
            }
          }
        }
      }
      fs.writeFile(location + "/"+ answers.api  +".json", JSON.stringify(swaggerJson, null, 2), function(err) {
        if(err) {
          cb(err, {});
        }
        console.log("Swagger JSON File successfully generated in : " + location + "/"+ answers.api  +".json");
        cb(null, {});
      });
    });
  });
}


function loadXMLDoc(filePath, cb) {
  try {
    var fileData = fs.readFileSync(filePath, 'ascii');
    var parser = new xml2js.Parser();
    parser.parseString(fileData.substring(0, fileData.length), function (err, result) {
      cb(null, result);
    });
  } catch (ex) {console.log(ex)}
}