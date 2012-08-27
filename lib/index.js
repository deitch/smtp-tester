/*jslint node:true, nomen:true */

// get the authentication/sessionManager library and the authorization library
var smtp = require('simplesmtp'), _ = require('underscore'), mimelib = require('mimelib-noiconv'), path = require('path'),
//mp = require("mailparser").MailParser, 
mailSplitter, modules = {};


mailSplitter = function(data) {
	var ret = {}, lastChar = null, buffer, i, h;
	data = data || "";
	// each line is a header, until we hit \r\r which is then followed by the message text itself through the end
	// although we need to support folded lines http://tools.ietf.org/html/rfc2822#section-2.2.3 per https://github.com/revington
	// and https://github.com/deitch/smtp-tester/issues/2
	buffer = "";
	for (i=0; i<data.length; i++) {
		if (data[i] === "\r") {
		  // ignore line feeds once we have carriage returns
		  if (data[i+1] === "\n") {
		    i++;
		  }
			// was the last line also a CR?
			if (data[i+1] === "\r") {
			  i++;
  		  // ignore line feeds once we have carriage returns
			  if (data[i+1] === "\n") {
			    i++;
			  }
				// all the rest from here until the end is the data
				ret.body = data.substring(i+1);
				i = data.length;
			} else if (data[i+1].match(/\s/)) {
			  // handle folded headers - find the first element that is not whitespace or carriage return
			  i++;
			  while(data[i].match(/(\s|\r|\n)/)) {
			    i++;
			  }
			  buffer += " "+data[i];
			} else {
				// take the previous line and save it
				// split on :
				/*jslint regexp:false */  
				h = buffer.match(/^\s*([^:]+):\s*(.+)\s*$/);
				/*jslint regexp:true */
				ret.headers = ret.headers || {};
				ret.headers[h[1]] = h[2];
				buffer = "";
			}
		} else {
			buffer += data[i];
		}
		lastChar = data[i];
	}
	return(ret);
};

module.exports = {
	init: function(port) {
		var msgs = {}, msgid = 1, handlers = {}, processMsg, smtpServer, that;
		smtpServer = smtp.createServer();
		smtpServer.on("startData",function(envelope){
		  envelope.body = "";
		});
		smtpServer.on("data",function(envelope,chunk){
		  envelope.body += chunk;
		});
		smtpServer.on("dataReady",function(envelope,callback){
			var email = {sender: null, receivers: {}, data: ""};
			email.sender = envelope.from;
			_.each(envelope.to||[],function(rcpt){
				/*jslint regexp:false */
				email.receivers[rcpt.replace(/^[^<]*</g,"").replace(/>[^>]*$/g,"")] = true;
				/*jslint regexp:true */
			});
			email.data = envelope.body;
			_.extend(email,mailSplitter(email.data) || {});
			// is this email encoded quotedprintable? decode it
			if (email.headers && email.headers["Content-Transfer-Encoding"] && email.headers["Content-Transfer-Encoding"].toLowerCase() === "quoted-printable") {
				email.body = mimelib.decodeQuotedPrintable(email.body);
			}
			msgs[msgid++] = email;
			processMsg(email,msgid);
			callback(null);
		});
		
		smtpServer.listen(port,function(err){
		});

		processMsg = function(email,msgid) {
			// catch-all handlers
			_.each(handlers.ALL || [],function(entry){
				if (entry && typeof(entry) === "function") {
					entry(null,msgid,email);
				}
			});
			// address-specific handlers
			_.each(email.receivers,function(val,key){
				_.each(handlers[key] || [],function(entry){
					if (entry && typeof(entry) === "function") {
						entry(key,msgid,email);
					}
				});
			});
		};

		that = {
			bind: function(rcpt,handler) {
				// first bind for new messages
				// what if there is no rcpt given? then bind for ALL messages
				if (!handler && rcpt && typeof(rcpt) === "function") {
					handler = rcpt;
					rcpt = null;
					handlers.ALL = handlers.ALL || [];
					handlers.ALL.push(handler);
				} else {
					handlers[rcpt] = handlers[rcpt] || [];
					handlers[rcpt].push(handler);
				}
				// next see if any were already in queue
				_.each(msgs,function(email,msgid){
					if ((email.receivers && email.receivers[rcpt]) || !rcpt) {
						handler(rcpt,msgid,email);
					}
				});
			},
			unbind: function(rcpt,handler) {
				var tmp = [];
				// what if there is no rcpt given? then bind for ALL messages
				if (!handler && rcpt && typeof(rcpt) === "function") {
					handler = rcpt;
					rcpt = "ALL";
				}
				_.each(handlers || [],function(ary,r2){
					if (r2 === rcpt && ary) {
						tmp[r2] = [];
						_.each(ary,function(h){
							if (h !== handler) {
								// keep the handler
								tmp[r2].push(h);
							}
						});
					} else {
						tmp[r2] = ary;
					}
				});
				// replace the old handlers with the new list
				handlers = tmp;
			},
			remove: function(msgid) {
				if (msgid) {
					delete msgs[msgid];
				}
			},
			removeAll: function() {
				msgs = {};
			},
			stop: function(cb) {
			  smtpServer.end(cb||function(){});
			},
			module: function(name) {
				var mod, filename = __dirname+'/modules/'+name+'.js', success = false, args = Array.prototype.slice.call(arguments,1);
				// load a particular pre-defined module with its bind/unbind
				if (path.existsSync(filename)) {
					mod = require(filename);
					if (mod && mod.setServer && typeof(mod.setServer) === "function") {
						mod.setServer(that);
					}
					if (mod && mod.init && typeof(mod.init) === "function") {
						mod.init.apply(mod,args);
					}
					modules[name] = mod;
					success = true;
				}
				return(success);
			},
			unmodule: function(name) {
				if (modules[name] && modules[name].stop && typeof(modules[name].stop) === "function") {
					modules[name].stop();
				}
			}
		};
		return(that);
	}
};

