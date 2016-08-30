var fs = require('fs');
var xml2js = require('xml2js');
var url = require('url');


module.exports = {
  genopenapi: genopenapi
}

function genopenapi(location, answers, xmlFile, cb) {
  var openapiJson = {};
  loadXMLDoc(location + "/apiproxy/" + answers.api + ".xml", function(err, reply) {
    openapiJson.swagger = "2.0";
    // Info Section
    openapiJson.info = {};
    try {
      openapiJson.info.description = reply.APIProxy.Description ? reply.APIProxy.Description[0] : '';
      openapiJson.info.version = (reply.APIProxy.$.revision || "1") + ".0.0";
      openapiJson.info.title = reply.APIProxy.DisplayName ? reply.APIProxy.DisplayName[0] : answers.api;
      openapiJson.info.contact = {}
      openapiJson.info.contact.email = reply.APIProxy.CreatedBy[0] || '';
    } catch (ex) {console.log(ex)}
    // Host & BasePath Section..
    var proxy = url.parse(answers.proxyEndPoint);
    openapiJson.host = proxy.host ? proxy.host : '';
    var schemes = [];
    var protocol = proxy.protocol ? proxy.protocol : 'http';
    schemes.push(protocol.substring(0, protocol.length -1));
    openapiJson.schemes = schemes;
    loadXMLDoc(xmlFile, function(err, replyProxy) {
      // Add base path
      try {
        openapiJson.basePath = replyProxy.ProxyEndpoint.HTTPProxyConnection[0].BasePath[0];
      } catch (ex) {console.log(ex);}

      // Add Paths
      openapiJson.paths = {};
      for (key in replyProxy.ProxyEndpoint.Flows[0].Flow) {
        var openapiPath = JSON.parse(JSON.stringify(replyProxy.ProxyEndpoint.Flows[0].Flow[key]));
        if (openapiPath["Condition"] != null) {
          var flowCondition = openapiPath["Condition"].pop();
          // Get Path & Verb...
          var rxVerb = /request.verb = "(.*?)"/g;
          var rxPath = /proxy.pathsuffix MatchesPath "(.*?)"/g;
          var verbArr = rxVerb.exec(flowCondition);
          var pathArr = rxPath.exec(flowCondition);
          var resourcePath = '', resourceVerb = ''
          if (verbArr != null && pathArr != null) {
            resourcePath = pathArr[1];
            resourceVerb = verbArr[1].toLowerCase();
            if (!openapiJson.paths[resourcePath]) openapiJson.paths[resourcePath] = {}
            openapiJson.paths[resourcePath][resourceVerb] = {};
            openapiJson.paths[resourcePath][resourceVerb].operationId = openapiPath.$.name;
            if (openapiPath.Description != null) {
              openapiJson.paths[resourcePath][resourceVerb].summary = openapiPath.Description[0];
            }
            var resourceResponse = {
              "200": {
                "description": "successful operation"
              }
            };
            openapiJson.paths[resourcePath][resourceVerb].responses = resourceResponse;
            // Add parameters if path includes dynamic value....
            var rxParam = /\{(.*?)\}/g;
            var rxParamArr = pathArr[1].match(rxParam);
            if (rxParamArr != null) {
              // Add Parameters
              openapiJson.paths[resourcePath][resourceVerb].parameters = [];
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
                openapiJson.paths[resourcePath][resourceVerb].parameters.push(parameterObj);
              }
            }

            if (!openapiJson.paths[resourcePath][resourceVerb].parameters)
              openapiJson.paths[resourcePath][resourceVerb].parameters = []

            // Loop through policies in Request
            for (stepKey in openapiPath.Request[0].Step) {
              var flowStepPath = JSON.parse(JSON.stringify(openapiPath.Request[0].Step[stepKey]));
              // Open policy document
              loadXMLDoc(location + "/apiproxy/policies/" + flowStepPath.Name + ".xml", function(err, replyStep) {
                // Check if this is Extract Variables policy
                if (replyStep.ExtractVariables) {
                  // If source is 'request' then capture as parameters
                  var source = ''
                  if (!replyStep.ExtractVariables.Source) {
                    // If source is not defined and since we are in Request flow then default is request
                    source = 'request'
                  } else if (replyStep.ExtractVariables.Source[0]["_"]) {
                    // If source include att, then capture content as such
                    source = replyStep.ExtractVariables.Source[0]["_"]
                  } else {
                    // Otherwise just read content
                    source = replyStep.ExtractVariables.Source
                  }

                  if (source == 'request') {
                    // Capture Header parameters
                    addParamsFromExtractVariables(replyStep.ExtractVariables.Header, 'header', openapiJson.paths[resourcePath][resourceVerb])
                    // Capture QueryParam
                    addParamsFromExtractVariables(replyStep.ExtractVariables.QueryParam, 'query', openapiJson.paths[resourcePath][resourceVerb])
                    // Capture FormParam
                    addParamsFromExtractVariables(replyStep.ExtractVariables.FormParam, 'formData', openapiJson.paths[resourcePath][resourceVerb])
                  }
                }
              })
            }
          }
        }
      }
      var rxJsonName = /proxies\/(.*?).xml/g;
      var jsonNameArr = rxJsonName.exec(xmlFile);
      var jsonFileName = answers.api;
      if (jsonNameArr != null) {
        if (jsonNameArr[1] != "default") {
          jsonFileName = jsonNameArr[1];
        }
      }
      fs.writeFile(location + "/"+ jsonFileName  +".json", JSON.stringify(openapiJson, null, 2), function(err) {
        if(err) {
          cb(err, {});
        }
        console.log("openapi JSON File successfully generated in : " + location + "/"+ jsonFileName  +".json");
        cb(null, {});
      });
    });
  });
}

function addParamsFromExtractVariables(paramArr, openapiType, openapiJson) {
  for (key in paramArr) {
    var path = JSON.parse(JSON.stringify(paramArr[key]));
    var parameterObj = {
        name: path.$.name,
        in: openapiType,
        required: true,
        type: 'string'
    }
    openapiJson.parameters.push(parameterObj);
  }
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
