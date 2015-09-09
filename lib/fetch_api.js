var inquirer = require('inquirer');
var apigeetool = require('apigeetool');
var pathLib = require('path');
var unzip = require('unzip');
var fs = require('fs');

module.exports = {
  fetchProxy: fetchProxy
};

var questions = [
  { name: 'baseuri',      message: 'Base URI?', default: 'https://api.enterprise.apigee.com' },
  { name: 'organization', message: 'Organization?'},
  { name: 'username',     message: 'User Id?'},
  { name: 'password',     message: 'Password?', type: 'password' },
  { name: 'api', message: 'API Proxy Name ?'},
  { name: 'revision',     message: 'Revision Number ?', default: 1},
];

function fetchProxy(options, cb) {

  inquirer.prompt( questions, function( answers ) {
    var destination = options.file || pathLib.join(__dirname, '../api_bundles/' + answers.api + ".zip");
    answers.file = destination;
    for (answer in answers) {
      if (!answers[answer]) {
        throw new Error("Missing input : " + answer);
        return cb("Missing input : " + answer, {});
      }
    }
    // Get Bundle from Apigee...
    apigeetool.fetchProxy(answers, function(err) {
      // Unzip folder.....
      console.log("hello");
      console.log(destination);
      fs.createReadStream(destination).pipe(unzip.Extract({ path: pathLib.join(__dirname, '../api_bundles/') }));
    });
  });
}