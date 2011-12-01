/*jslint node:true, nomen:false */

// get the authentication/sessionManager library and the authorization library
var smtp = require('smtp'), _ = require('underscore'), mimelib = require('mimelib-noiconv'), mailSplitter;


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
		var msgs = {}, msgid = 1, handlers = {}, processMsg, smtpServer;
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
			_.each(email.receivers,function(val,key){
				_.each(handlers[key] || [],function(entry){
					if (entry && typeof(entry) === "function") {
						entry(key,msgid,email);
					}
				});
			});
		};

		return {
			bind: function(rcpt,handler) {
				// first bind for new messages
				handlers[rcpt] = handlers[rcpt] || [];
				handlers[rcpt].push(handler);
				// next see if any were already in queue
				_.each(msgs,function(email,msgid){
					if (email.receivers && email.receivers[rcpt]) {
						handler(rcpt,msgid,email);
					}
				});
			},
			unbind: function(rcpt,handler) {
				var tmp = [];
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
			}
		};
	}
};

