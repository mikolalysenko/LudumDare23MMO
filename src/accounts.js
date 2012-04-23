"use strict";

var util = require('util');

function Account(manager, data) {
  this.active = true;
  this.manager = manager;
  this.data = data;
}

//Apply changes to account
Account.prototype.update = function() {
  if(!this.active) {
    return;
  }
  
  util.log("Updating account: " + JSON.stringify(this.data));
  this.manager.db.accounts.update({_id:this.data._id}, this.data);
}

//Logs out account
Account.prototype.logout = function() {
  if(!this.active) {
    return;
  }
  util.log("Logging out: " + JSON.stringify(this.data));
  this.data.logged_in = false;
  this.active = false;
  this.data.logged_in = false;
  this.manager.db.accounts.update({_id:this.data._id}, this.data);
}

//Account manager
function AccountManager(db, defaultAttribs) {
  this.db = db;
  this.defaultAttribs = defaultAttribs
}

//Retrieves a user account
AccountManager.prototype.tryLogin = function(user_id, cb) {
  //If user is temporary, create a random account for them
  if(user_id === "temporary") {
    util.log("Temporary user");
    user_id = "temp" + Math.random();
  }
  //First, check for account
  var db = this.db, account_manager = this;
  db.accounts.findOne({'user_id':user_id}, function(err, account) {
    if(err) {
      util.log("Error searching for account");
      cb(err, null);
    } else if(account) {
      //Account exists, check login
      if(account.logged_in) {
        cb("Already logged in", null);
      } else {
        db.accounts.update({_id: account._id}, { '$set': { logged_in : true } }, {safe:true}, function(err) {
          if(err) {
            cb(err, null);
          } else {
            util.log("Logging into account:" + JSON.stringify(account));
            cb(null, new Account(account_manager, account));
          }
        });
      }
    } else {
      //Create new account
      var account = { 
         'user_id': user_id
        , logged_in: true
        , attribs: account_manager.defaultAttribs() };
      util.log("Creating new account: " + JSON.stringify(account));
      db.accounts.save(account, function(err) {
        if(err) {
          cb(err, null);
        } else {
          cb(null, new Account(account_manager, account));
        }
      });
    }
  });
}

exports.AccountManager = AccountManager;

