var inquirer = require('inquirer');
var pathLib = require('path');
var unzip = require('unzip');
var fs = require('fs');
var apiBundle = require('./downloadApi.js');
var proxy = require('./proxy2openapi.js');
var mkdirp = require('mkdirp');
var glob = require('glob');
var async = require('async');

module.exports = {
  fetchProxy: fetchProxy
};

var questions = [
  { name: 'baseuri',      message: 'Base URI?', default: 'https://api.enterprise.apigee.com' },
  { name: 'organization', message: 'Organization?'},
  { name: 'username',     message: 'User Id?'},
  { name: 'password',     message: 'Password?', type: 'password'},
  { name: 'api', message: 'API Proxy Name ?'},
  { name: 'revision',     message: 'Revision Number ?', default: 1},
  { name: 'proxyEndPoint',     message: 'API Proxy End Point ?', default: 'https://{ORGNAME}-{ENV}.apigee.net'},
];

function fetchProxy(options, cb) {

  inquirer.prompt( questions, function( answers ) {
    var destination = options.destination  || pathLib.join(__dirname, '../api_bundles');
    destination = destination + "/" + answers.api;
    answers.file = destination + "/" + answers.api + ".zip";
    for (answer in answers) {
      if (!answers[answer]) {
        throw new Error("Missing input : " + answer);
        return cb("Missing input : " + answer, {});
      }
    }
    // create destination folder..
    mkdirp(destination, function (err) {
      if (err) {
        return cb(err, {});
      }
      // Get Bundle from Apigee...
      apiBundle.downloadProxy(answers, function(err) {
        if (err) {
          return cb(err, {});
        }
        // Unzip folder.....
        var stream = fs.createReadStream(answers.file).pipe(unzip.Extract({ path: destination }));
        var had_error = false;
        stream.on('error', function(err){
          had_error = true;
          return cb(err, {});
        });
        stream.on('close', function(){
          if (!had_error) {
            // generate openapi...
            delete answers['password'];
            // Generate multiple openapi files based on number of files in proxies.
            // Read through proxy files..

            glob(destination + "/apiproxy/proxies"+ "/*.xml", options, function (er, files) {
              async.each(Object.keys(files), function (i, callback) {
                proxy.genopenapi(destination, answers, files[i], function (err, reply) {
                  if (err) {
                    callback(err, {});
                  }
                  callback(null, {});
                });
              }, function (err) {
                // if any of the file processing produced an error, err would equal that error
                if (err) {
                  cb(err, {})
                }
                else {
                  cb(null, {});
                }
              });
            });
          }
        });
      });
    });
  });
}

