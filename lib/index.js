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
	// RegExp matches headers (including split line headers) and body
	var split = data.match(/^(([^\r\n:]+:\s+[^\r\n]+(\r\n [^\r\n]+)*\r\n)+)\r\n([^]*)$/);
	if (! split)
		return ret;
	// Body will always be last match
	ret.body = split.slice(-1)[0];
	// Headers will be first match
	ret.headers = split[1].replace(/\r\n /g, ' ')
		.replace(/\r/g, '').split('\n')
		.reduce(function (orig, cur) { // Reduce each header into a new Object
			cur = cur.split(':');
			if (cur.length === 2)
				orig[cur[0]] = cur[1].replace(/^(\s*)|(\s*)$/g, '');
			return orig;
		}, {});
	return ret;
};

module.exports = {
	init: function(port, smtpOptions) {
		var msgs = {}, msgid = 1, handlers = {}, processMsg, smtpServer, that;
		smtpServer = smtp.createServer(smtpOptions);
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
			// handle the http://tools.ietf.org/html/rfc2821#section-4.5.2 double-dot at the beginning of a line
			// thanks to http://github.com/andris9 for pointing it out
			email.body = email.body.replace(/^\.\./mg,'.');
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

