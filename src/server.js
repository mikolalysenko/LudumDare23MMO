var path          = require('path')
    ,url          = require('url')
    ,fs           = require('fs')
    ,util         = require('util')
    ,querystring  = require('querystring')
    ,mongodb      = require('mongodb')
    ,express      = require('express')
    ,png          = require('png-js')
    ,fs           = require('fs');

//Boot straps the game server
exports.start = function(settings) {

  console.log("Starting server -- settings = ", settings);
  var  sessions = new (require('./session.js').SessionHandler)()
      ,db = new mongodb.Db(settings.db_name
              , new mongodb.Server(
                  settings.db_server
                , settings.db_port
                , {
                  "auto-reconnect": true
                })
              , {})
      ,app     = express.createServer();
  
  function decodeMap(cb) {
  
    png.decode(path.join(__dirname, "data/worldmap.png"), function(pixels) {
      var lines = fs.readFileSync(path.join(__dirname, 'data/worldpalette.gpl')).toString().split('\n');
      var palette = {};
      for(var i=0; i<lines.length; ++i) {
        if(lines[i].charAt(0) === ":") {
          lines[i] = lines[i].substr(1);
        } 
        if(lines[i] in palette) {
          continue;
        }
        palette[lines[i]] = i;
      }
      var level = new Array(256*256);
      for(var i=0; i<256*256; ++i) {
        level[i] = palette[pixels[4*i]+":"+pixels[4*i+1]+":"+pixels[4*i+2]];
      }
      cb(level);
    });
  }
  
  
  //Connects to database, adds references for collections
  function initializeDB(next) {
    console.log("Initializing database");
    db.open(function(err, db) {
      if(err) {
        util.log("Error connecting to database");
        return;
      }
      
      function addCollections(next) {
        function addCollection(col, cb) {
          db.collection(col, function(err, collection) {
            if(err) {
              util.log("Error adding collection '" + col + "': " + err);
              return;
            }
            db[col] = collection;
            cb();
          });
        }
        addCollection('accounts', function() {
          db.accounts.ensureIndex([['user_id', 1]], {unique:true}, function() {
            next(db);
          });
        });
      }
      
      
      function clearLoggedIn() {
        db.accounts.update({}, 
          {'$set': {logged_in: false}}, 
          {safe:true, multi:true}, 
          function(err, count) {
            if(err) {
              util.log("Error clearing logged_in bit");
              return;
            }
            next(db);
          });
      }
      
      
      var db_user = settings.db_user, db_passwd = settings.db_password;

      console.log("Authenticating, username = ", db_user)

      if(db_user || db_passwd) {
        db.authenticate(db_user, db_passwd, function(err) {
          if(err) {
            util.log("Error authenticating with database");
            return;
          }
          addCollections(clearLoggedIn);
        });
      }
      else {
        addCollections(clearLoggedIn);
      }
    });
  }

  //Attaches an open ID provider
  function attachOpenID(login_cb) {
    var openid = require('openid')
        ,relying_party = new openid.RelyingParty(
          settings.web_url + '/verify'
          ,null
          ,false
          ,false
          ,[])
        ,providers = settings.openid_providers;
    //Add handler to server      
    app.use(function(req, res, next) {
      var parsed_url = url.parse(req.url);
      if(parsed_url.pathname === '/authenticate') {
        var query         = querystring.parse(parsed_url.query)
            ,provider_str = query.provider;
        if(!provider_str || !(provider_str in providers)) {
          res.writeHead(200);
          res.end('Invalid provider');
          return;
        }
        //Authenticate with provider
        var provider = providers[provider_str];
        if(provider == "temp") {
          //Make a temporary account
          res.writeHead(302
            , {Location: settings.web_url + '/verify?temp=1'});
          res.end();
        }
        else {
          //Otherwise, verify through OpenID
          relying_party.authenticate(provider
            , false
            , function(error, auth_url) {
            
            if(error || !auth_url) {
              util.log("Authentication with provider failed!", error);
              res.writeHead(200);
              res.end('Authentication with provider failed');
            }
            else {
              res.writeHead(302, {Location: auth_url});
              res.end();
            }
          });
        }
      }
      else if(parsed_url.pathname === '/verify') {
        var query         = querystring.parse(parsed_url.query)
            ,temporary    = query.temp;
        if(temporary) {
          //Create temporary account and add to game
          login_cb(res, "temporary");
        }
        else {
          relying_party.verifyAssertion(req, function(error, result) {
            if(error || !result || !result.claimedIdentifier) {
              util.log("Failed to verify");
              res.writeHead(302, {Location: '/index.html'});
              res.end();
            }
            else {
              //Log in to database, send response
              util.log("Verified connection: " + result.claimedIdentifier);
              login_cb(res, result.claimedIdentifier);
            }
          });
        }
      } else {
        next();
      }
    });
  }

  //Create web server
  function createServer() {
    var client_html   = fs.readFileSync(path.join(__dirname, '../www/client.html'), 'utf-8')
        ,token_loc     = client_html.indexOf(settings.session_token)
        ,client_start  = new Buffer(client_html.substr(0, token_loc), 'utf-8')
        ,client_end    = new Buffer(client_html.substr(token_loc + settings.session_token.length), 'utf-8');
    //Attach static server for client data
    app.use(express.static(path.join(__dirname, '../www/')));
    //Attach browserify code
    var options = {
      require: [  path.join(__dirname, './client.js')
                  ,'events']
    };
    if(settings.debug) {
      options.watch = true;
      options.filter = function(src) {
        return '"use strict;"\n' + src;
      };
    }
    else {
      options.watch = false;
      options.filter = require("uglify-js");
    }
    app.use(require('browserify')(options));
    //Attach OpenID handler
    attachOpenID(function(res, user_id) {
      var now = (new Date()).toGMTString();
    
      res.setHeader('content-type', 'text/html');
      res.setHeader('last-modified', now);
      res.setHeader('date', now);
      res.statusCode = 200;
      
      res.write(client_start);
      res.write(sessions.setToken(user_id));
      res.end(client_end);
    });
  }

  //Starts the server
  util.log("Starting server...");
  initializeDB(function(db) {
    createServer();
    
    //Decode pixels
    decodeMap(function(level) {
      
      var server = app;
      
      //Start game stuff
      gs = new require('./game_server.js').GameServer({
         'settings':  settings
        ,'sessions':  sessions
        ,'db':        db
        ,'server':    server
        ,'level':     level
      });
      
      server.listen(settings.web_port);
      util.log("Game started, listening on: " + settings.web_port);
    });
  });

  if(settings.debug) {
    startREPL();
  }

  process.on('uncaughtException', function(err) {
    console.log(err.stack);
  });
}


function startREPL(gs) {
  function help() {
    console.log("Game server object is called gs");
  }
  require('repl').start('Admin>');
}

