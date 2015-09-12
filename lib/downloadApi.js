var fs = require('fs');
var request = require('request');
var url = require('url');
var util = require('util');


module.exports = {
  downloadProxy: downloadProxy
};

 function downloadProxy(opts, cb) {
  var uri;

  if (opts.api && opts.revision) {
    uri = util.format('%s/v1/o/%s/apis/%s/revisions/%s?format=bundle',
      opts.baseuri, opts.organization, opts.api, opts.revision);
  } else {
    cb(new Error('org, api and revision must all be specified! ' + JSON.stringify(opts)));
    return;
  }

  // Call the standard "deployments" API to get the list of what's deployed
  var request = defaultRequest(opts);
  if (opts.debug) {
    console.log('Going to invoke "%s"', uri);
  }

  //let's default to apiname.zip for the file to save
  var f = (opts.file) ? opts.file : opts.api + '.zip';

  request.get( { uri: uri, encoding: 'binary' }, function (err,res,body) {
    if (err) {
      cb(err);
    } else {
      if (opts.debug) {
        console.log ( 'Received: ' + res.statusCode + ' the following headers: ' + JSON.stringify(res.headers) );
      }
      if (res.statusCode !== 200) {
        cb(new Error(util.format('Received error %d when fetching proxy: %s',
          res.statusCode, body)));
      } else {
        fs.writeFile(f, body, 'binary', function(err) {
          if (err) {
            console.log( "Failed to write file: " + f );
            console.log( "Error text: " + err );
            cb(err);
          }
          else {
            console.log( 'Downloaded Bundle from Apigee: ' + f );
            cb(null);
          }
        });
      }
    }
  });
};

var defaultRequest = function(opts) {
  var ro = {
    auth: {
      username: opts.username,
      password: opts.password
    },
    json: true,
    agentOptions: {}
  };

  if (opts.baseuri) {
    var pu = url.parse(opts.baseuri);
    if ((pu.protocol === 'https:') &&
      process.env.https_proxy) {
      opts.proxy = process.env.https_proxy;

    } else if ((pu.protocol === 'http:') &&
      process.env.http_proxy) {
      opts.proxy = process.env.http_proxy;
    }
  }


  if (opts.cafile) {
    var files = opts.cafile.split(','),
      ca = [];

    _.each(files, function(file) {
      ca.push(fs.readFileSync(file))
    });

    ro.agentOptions.ca = ca;
  }

  if (opts.insecure) {
    ro.agentOptions.rejectUnauthorized = false;
  }

  return request.defaults(ro);
};
