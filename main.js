var path = require('path');

//Default settings
var settings = {

  //Web configuration
  web_domain  : 'localhost',
  web_port    : 8080,
  web_url     : 'http://localhost:8080',
  
  //Session token name
  session_token  : '$SESSION_TOKEN',
  
  //Database configuration
  db_name     : 'test',
  db_server   : 'localhost',
  db_port     : 27017,
  
  //Time out during login
  login_timeout : 100 * 1000,
  
  //OpenID stuff
  openid_providers : {
    'google': 'http://www.google.com/accounts/o8/id',
    'facebook': 'http://facebook.anyopenid.com',
    'twitter': 'http://twitter.anyopenid.com',
    'temp': 'temp',
  },
    
  //If this flag is set, don't compress the client
  debug       : true,
};

//Parse out arguments from commandline
var argv = require('optimist').argv;
for(var i in argv) {
  if(i in settings) {
    settings[i] = argv[i];
  }
}

//Start the server
require('./src/server.js').start(settings);
