/*jslint node:true, nomen:false */

// get the authentication/sessionManager library and the authorization library
var smtp = require('smtp'), _ = require('underscore'), mimelib = require('mimelib-noiconv'), path = require('path'), 
mailSplitter, modules = {};


mailSplitter = function(data) {
	var ret = {}, lastChar = null, twoBack = null, buffer, i, h;
	data = data || "";
	// each line is a header, until we hit \r\r which is then followed by the message text itself through the end
	buffer = "";
	for (i=0; i<data.length; i++) {
		if (data[i] === "\r") {
			// was the last line also a CR?
			if (twoBack === "\r") {
				// all the rest from here until the end is the data
				ret.body = data.substring(i+2);
				i = data.length;
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
		twoBack = lastChar;
		lastChar = data[i];
	}
	return(ret);
};

module.exports = {
	init: function(port) {
		var msgs = {}, msgid = 1, handlers = {}, processMsg, smtpServer, that;
		smtpServer = smtp.createServer(function(connection) {
			var email = {sender: null, receivers: {}, data: ""}, body = "";
		    connection.on('DATA', function(message) {
				// record a message from sender to receivers
				email.sender = message.sender;
				_.each(message.recipients,function(r){
					/*jslint regexp:false */
					email.receivers[r.address.replace(/^[^<]*</g,"").replace(/>[^>]*$/g,"")] = true;
					/*jslint regexp:true */
				});
				// record the data
				message.on('data', function(data) {
					body += data;
				});
				// message is complete: accept the data, record we have a valid email
				message.on('end', function() {
					email.data = body;
					message.accept();
					_.extend(email,mailSplitter(email.data) || {});
					// is this email encoded quotedprintable? decode it
					if (email.headers && email.headers["Content-Transfer-Encoding"] && email.headers["Content-Transfer-Encoding"].toLowerCase() === "quoted-printable") {
						email.body = mimelib.decodeQuotedPrintable(email.body);
					}
					msgs[msgid++] = email;
					processMsg(email,msgid);
				});
			});
		});
		smtpServer.listen(port);

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
			stop: function() {
				smtpServer.close();
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

