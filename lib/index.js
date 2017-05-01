/*jslint node:true, nomen:true */

const _                = require('underscore');
const fs               = require('fs');
const mimelib          = require('mimelib-noiconv');
const { simpleParser } = require("mailparser");
const { SMTPServer }   = require('smtp-server');


const modules = {};


module.exports = {
	init: function(port, smtpOptions) {
		var msgs = {}, msgid = 1, handlers = {}, processMsg, smtpServer, that;

    smtpServer = new SMTPServer({
      disabledCommands: ['AUTH', 'STARTTLS'],

      onAuth(auth, session, callback) {
        callback(null);
      },

      onMailFrom(address, session, callback) {
        callback(null);
      },

      onData(stream, session, callback) {
        const chunks = [];

        stream.on('data', function(buffer) {
          chunks.push(buffer);
        });

        stream.on('end', function() {
          const data = Buffer.concat(chunks).toString().replace(/\r\n$/, '');

          buildEmail(session.envelope, data, function(err, email) {
            if (err)
              callback(err);
            else {
              msgs[++msgid] = email;
              processMsg(email, msgid);

              callback(null, 'OK');
            }
          });
        });
      }
    });

		smtpServer.listen(port, false);

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
				var tmp = {};
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
				smtpServer.close(cb);
			},
			module: function(name) {
				var mod, filename = __dirname+'/modules/'+name+'.js', success = false, args = Array.prototype.slice.call(arguments,1);
				// load a particular pre-defined module with its bind/unbind
				/*jslint stupid:true */
				if (fs.existsSync(filename)) {
					/*jslint stupid:false */
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


// Resolves to the email object handlers receive.
function buildEmail(envelope, data, callback) {
  simpleParser(data, function(err, parsedEmail) {
    if (err)
      callback(err);
    else {
      const sender    = envelope.mailFrom.address;
      const receivers = envelope.rcptTo
        .map(recipient => [ recipient.address, true ])
        .reduce(tupleToObject, {});

      const headers   = [ ... parsedEmail.headers ]
        .map(readHeader)
        .reduce(tupleToObject, {});

      const email     = {
        sender,
        receivers,
        data,
        headers,
        body:      parsedEmail.text
      };

      callback(null, email);
    }
  });
}


function readHeader([ name, value ]) {
  if (value && value.text)
    return [ name, value.text ];
  else
    return [ name, value ];
}


function tupleToObject(accum, [ key, value ]) {
  return Object.assign({}, accum, { [key]: value });
}
