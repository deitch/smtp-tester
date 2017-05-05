const path             = require('path');
const { simpleParser } = require('mailparser');
const { SMTPServer }   = require('smtp-server');


module.exports = {
  init(port) {
    const modules       = new Map();
    const messages      = new Map();
    let   handlers      = [];
    let   lastMessageID = 0;

    const smtpServer = createSMTPServer(function(email) {
      lastMessageID++;
      messages.set(lastMessageID, email);
      dispatchMessage(handlers, lastMessageID, email);
    });

    smtpServer.listen(port);

    const smtpTester = {
      bind(recipient, handler) {
        // Missing recipient means bind for all messages.
        if (!handler && recipient && typeof recipient === 'function')
          _bind('ALL', recipient);
        else
          _bind(recipient, handler);
      },
      unbind(recipient, handler) {
        // Missing recipient means unbind for all messages.
        if (!handler && recipient && typeof recipient === 'function')
          _unbind('ALL', recipient);
        else
          _unbind(recipient, handler);
      },
      captureOne(recipient, { wait } = {}) {
        return new Promise(function(resolve, reject) {
          function handler(address, id, email) {
            smtpTester.unbind(recipient, handler);
            smtpTester.remove(id);
            resolve({ address, id, email });
          }

          smtpTester.bind(recipient, handler);

          if (wait > 0) {
            setTimeout(function() {
              smtpTester.unbind(recipient, handler);
              const error = new Error(`No message delivered to ${recipient}`);
              reject(error);
            }, wait);
          }
        });
      },
      remove(messageID) {
        if (messageID)
          messages.delete(messageID);
      },
      removeAll() {
        messages.clear();
      },
      stop(callback) {
        smtpServer.close(callback);
      },
      module(name, ... args) {
        // Load a particular pre-defined module.
        // Run the module's init hook if present.

        const modulePath   = path.join(__dirname, 'modules', name);
        const loadedModule = require(modulePath); // eslint-disable-line global-require

        loadedModule.setServer(smtpTester);

        if (typeof loadedModule.init === 'function')
          loadedModule.init(... args);

        modules.set(name, loadedModule);

        return true;
      },
      unmodule(name) {
        const loadedModule = modules.get(name);

        if (loadedModule && typeof loadedModule.stop === 'function')
          loadedModule.stop();

        modules.delete(name);
      }
    };

    function _bind(recipient, fn) {
      handlers = handlers.concat([{ recipient, fn }]);

      for (const [ messageID, message ] of messages) {
        if (recipient === 'ALL')
          fn(null, messageID, message);
        else if (message.receivers[recipient])
          fn(recipient, messageID, message);
      }
    }

    function _unbind(recipientToUnbind, fnToUnbind) {
      const newHandlers = handlers.filter(({ recipient, fn }) => !(recipient === recipientToUnbind && fn === fnToUnbind));
      handlers = newHandlers;
    }

    return smtpTester;
  }
};


// Resolves to the email object handlers receive.
function buildEmail(envelope, data) {
  return simpleParser(data)
    .then(function(parsedEmail) {
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

      return email;
    });
}


function createSMTPServer(onEmail) {
  return new SMTPServer({
    disabledCommands: [ 'AUTH', 'STARTTLS' ],

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

        buildEmail(session.envelope, data)
          .then(onEmail)
          .then(() => callback(null, 'OK'))
          .catch(callback);
      });
    }
  });
}


function dispatchMessage(handlers, messageID, email) {
  handlers
    .filter(({ recipient }) => recipient === 'ALL' || email.receivers[recipient])
    .forEach(({ recipient, fn }) => fn(recipient === 'ALL' ? null : recipient, messageID, email));
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
